import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import type { ChatMessage } from "../types";

const EMOTION_EMOJIS: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  surprised: "😲",
  relaxed: "😌",
  neutral: "😐",
  thinking: "🤔",
  excited: "🎉",
  embarrassed: "😅",
  shy: "☺️",
  crying: "😭",
  laughing: "😂",
  smile: "🙂",
};

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  onSend: (message: string) => void;
  characterName: string;
}

export function ChatPanel({
  messages,
  isLoading,
  isStreaming,
  onSend,
  characterName,
}: ChatPanelProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !isStreaming) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">Chat with {characterName}</p>
              <p className="text-sm">
                Send a message to start the conversation!
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={
                msg.role === "user"
                  ? "chat-bubble-user"
                  : "chat-bubble-character"
              }
            >
              {msg.role === "character" && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-indigo-300">
                    {characterName}
                  </span>
                  {msg.emotion && msg.emotion !== "neutral" && (
                    <span className="emotion-badge bg-indigo-500/20 text-indigo-300">
                      {EMOTION_EMOJIS[msg.emotion] ?? ""} {msg.emotion}
                    </span>
                  )}
                </div>
              )}
              <div className="text-sm">
                {msg.content ||
                  (msg.role === "character" && isLoading ? "..." : "")}
              </div>
              {msg.english_subtitle && (
                <div className="text-xs text-gray-400 mt-1 border-t border-gray-600 pt-1">
                  {msg.english_subtitle}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isStreaming
                ? "Waiting for response..."
                : `Message ${characterName}...`
            }
            disabled={isLoading || isStreaming}
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 text-sm border border-gray-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || isStreaming || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
