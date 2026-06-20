import type { Character, ChatResponse, HealthResponse } from "../types";

const API_BASE = "";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function getCharacters(): Promise<Character[]> {
  return request<Character[]>("/api/characters");
}

export async function sendChat(
  characterId: string,
  message: string,
  sessionId = "default",
): Promise<ChatResponse> {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      character_id: characterId,
      message,
      session_id: sessionId,
    }),
  });
}

export async function* streamChat(
  characterId: string,
  message: string,
  sessionId = "default",
): AsyncGenerator<{ event: string; data: unknown }> {
  const params = new URLSearchParams({
    character_id: characterId,
    message,
    session_id: sessionId,
  });

  const res = await fetch(`/api/chat/stream?${params}`);
  if (!res.ok) throw new Error(`Stream error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const dataStr = line.slice(5).trim();
        try {
          const data = JSON.parse(dataStr);
          yield { event: currentEvent, data };
        } catch {
          // Skip malformed JSON
        }
        currentEvent = "";
      }
    }
  }
}

// TTS API types and endpoint
export interface TTSRequest {
  text: string;
  character_id: string;
  provider?: string;
}

export interface VisemeTiming {
  viseme: string;
  time_ms: number;
  duration_ms: number;
}

export interface TTSResponse {
  audio_url: string; // Relative URL like /api/tts/audio/abc123.wav
  duration_ms: number;
  visemes: VisemeTiming[];
}

export async function synthesizeSpeech(req: TTSRequest): Promise<TTSResponse> {
  const response = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }

  return response.json();
}
