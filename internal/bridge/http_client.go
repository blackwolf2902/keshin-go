package bridge

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// ChatRequest is the request to the Python AI chat endpoint.
type ChatRequest struct {
	CharacterID       string    `json:"character_id"`
	Message           string    `json:"message"`
	SessionID         string    `json:"session_id,omitempty"`
	PersonalityPrompt string    `json:"personality_prompt,omitempty"`
	CharacterName     string    `json:"character_name,omitempty"`
	CharacterLang     string    `json:"character_lang,omitempty"`
	History           []Message `json:"history,omitempty"`
}

// Message in the conversation history.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse from the Python AI service.
type ChatResponse struct {
	JapaneseText     string  `json:"japanese_text"`
	EnglishSubtitle  string  `json:"english_subtitle"`
	Emotion          string  `json:"emotion"`
	EmotionIntensity float64 `json:"emotion_intensity"`
	Model            string  `json:"model"`
	AudioUrl         string  `json:"audio_url"`
	AudioDurationMs  float64 `json:"audio_duration_ms"`
	Error            string  `json:"error,omitempty"`
}

// StreamChunk represents a single SSE event from the streaming endpoint.
type StreamChunk struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

// HealthResponse from the Python AI service.
type HealthResponse struct {
	Status    string            `json:"status"`
	Providers map[string]string `json:"providers"`
}

// Client is an HTTP client for the Python AI service.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new bridge client.
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// BaseURL returns the base URL of the Python AI service.
func (c *Client) BaseURL() string {
	return c.baseURL
}

// Chat sends a chat request to the Python AI service.
func (c *Client) Chat(req ChatRequest) (*ChatResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/chat",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("http post: %w", err)
	}
	defer resp.Body.Close()

	raw, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, fmt.Errorf("read python response (HTTP %d): %w", resp.StatusCode, readErr)
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(raw, &chatResp); err != nil {
		return nil, fmt.Errorf("python returned HTTP %d: %s", resp.StatusCode, string(raw))
	}

	if resp.StatusCode >= 400 {
		if chatResp.Error != "" {
			return nil, fmt.Errorf("python error (HTTP %d): %s", resp.StatusCode, chatResp.Error)
		}
		return nil, fmt.Errorf("python returned HTTP %d: %s", resp.StatusCode, string(raw))
	}

	return &chatResp, nil
}

// ChatStream sends a streaming chat request and returns a channel of stream chunks.
func (c *Client) ChatStream(req ChatRequest) (<-chan StreamChunk, error) {
	params := url.Values{}
	params.Set("character_id", req.CharacterID)
	params.Set("message", req.Message)
	if req.SessionID != "" {
		params.Set("session_id", req.SessionID)
	}
	if req.PersonalityPrompt != "" {
		params.Set("personality_prompt", req.PersonalityPrompt)
	}
	if req.CharacterName != "" {
		params.Set("character_name", req.CharacterName)
	}
	if req.CharacterLang != "" {
		params.Set("character_lang", req.CharacterLang)
	}

	streamURL := c.baseURL + "/api/chat/stream?" + params.Encode()
	resp, err := c.httpClient.Get(streamURL)
	if err != nil {
		return nil, fmt.Errorf("http get stream: %w", err)
	}

	ch := make(chan StreamChunk, 64)
	go func() {
		defer resp.Body.Close()
		defer close(ch)

		scanner := bufio.NewScanner(resp.Body)
		var currentEvent string

		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue // end of event
			}
			if len(line) > 6 && line[:6] == "event:" {
				currentEvent = line[6:]
				continue
			}
			if len(line) > 5 && line[:5] == "data:" {
				data := line[5:]
				ch <- StreamChunk{
					Event: currentEvent,
					Data:  json.RawMessage(data),
				}
				currentEvent = ""
			}
		}
	}()

	return ch, nil
}

// Health checks the health of the Python AI service.
func (c *Client) Health() (*HealthResponse, error) {
	resp, err := c.httpClient.Get(c.baseURL + "/health")
	if err != nil {
		return nil, fmt.Errorf("http get health: %w", err)
	}
	defer resp.Body.Close()

	var healthResp HealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&healthResp); err != nil {
		return nil, fmt.Errorf("decode health: %w", err)
	}

	return &healthResp, nil
}

// ReadAll reads all data from a channel of StreamChunks.
func ReadAll(ch <-chan StreamChunk) []StreamChunk {
	var chunks []StreamChunk
	for chunk := range ch {
		chunks = append(chunks, chunk)
	}
	return chunks
}
