package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path/filepath"

	"github.com/blackwolf2902/keshin-go/internal/bridge"
	"github.com/blackwolf2902/keshin-go/internal/pack"
	"go.uber.org/zap"
)

// enrichRequest loads the character pack and fills in personality prompt.
func (s *Server) enrichRequest(req *bridge.ChatRequest) {
	if req.CharacterID == "" {
		req.CharacterID = s.cfg.Character.Default
	}
	// Only load pack if personality not already provided
	if req.PersonalityPrompt == "" {
		packsDir := s.cfg.Character.PacksDir
		if packsDir == "" {
			packsDir = "packs"
		}
		packDir := filepath.Join(packsDir, req.CharacterID)
		p, err := pack.LoadPack(packDir)
		if err != nil {
			s.logger.Warn("Failed to load character pack", zap.String("character", req.CharacterID), zap.Error(err))
			return
		}
		req.PersonalityPrompt = p.SystemPrompt
		req.CharacterName = p.Character.Name
		req.CharacterLang = p.Character.Lang
	}
}

// handleChat handles synchronous chat requests.
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "read body: " + err.Error()})
		return
	}
	defer r.Body.Close()

	var req bridge.ChatRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON: " + err.Error()})
		return
	}

	if req.Message == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message is required"})
		return
	}

	s.enrichRequest(&req)

	s.logger.Info("Chat request",
		zap.String("character", req.CharacterID),
		zap.String("message", req.Message),
	)

	resp, err := s.bridge.Chat(req)
	if err != nil {
		s.logger.Error("Chat failed", zap.Error(err))
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// handleTTS proxies TTS synthesis requests to the Python AI service.
func (s *Server) handleTTS(w http.ResponseWriter, r *http.Request) {
	s.proxyToPython(w, r)
}

// handleTTSAudio proxies TTS audio file serving to the Python AI service.
func (s *Server) handleTTSAudio(w http.ResponseWriter, r *http.Request) {
	s.proxyToPython(w, r)
}

// proxyToPython reverse-proxies the request to the Python AI backend.
func (s *Server) proxyToPython(w http.ResponseWriter, r *http.Request) {
	target, _ := url.Parse(s.bridge.BaseURL())
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ServeHTTP(w, r)
}

// handleChatStream handles Server-Sent Events streaming chat requests.
func (s *Server) handleChatStream(w http.ResponseWriter, r *http.Request) {
	characterID := r.URL.Query().Get("character_id")
	message := r.URL.Query().Get("message")
	sessionID := r.URL.Query().Get("session_id")

	if message == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message is required"})
		return
	}

	req := bridge.ChatRequest{
		CharacterID: characterID,
		Message:     message,
		SessionID:   sessionID,
	}

	s.enrichRequest(&req)

	ch, err := s.bridge.ChatStream(req)
	if err != nil {
		s.logger.Error("Chat stream failed", zap.Error(err))
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming not supported"})
		return
	}

	for chunk := range ch {
		eventLine := fmt.Sprintf("event: %s\n", chunk.Event)
		dataLine := fmt.Sprintf("data: %s\n\n", string(chunk.Data))

		if _, err := io.WriteString(w, eventLine); err != nil {
			s.logger.Error("SSE write event failed", zap.Error(err))
			return
		}
		if _, err := io.WriteString(w, dataLine); err != nil {
			s.logger.Error("SSE write data failed", zap.Error(err))
			return
		}
		flusher.Flush()
	}
}
