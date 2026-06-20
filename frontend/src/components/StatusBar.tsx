import { Wifi, WifiOff, Cpu, Volume2, Loader2 } from "lucide-react";
import type { HealthResponse } from "../types";

interface StatusBarProps {
  health: HealthResponse | null;
  characterVoice?: string;
  isLoading: boolean;
}

export function StatusBar({
  health,
  characterVoice,
  isLoading,
}: StatusBarProps) {
  const isConnected = health?.status === "ok";
  const llmProvider = health?.providers?.llm ?? "unknown";
  const ttsProvider = health?.providers?.tts ?? characterVoice ?? "unknown";

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-800 border-b border-gray-700 text-xs text-gray-400">
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <Wifi className="w-3 h-3 text-green-500" />
        ) : (
          <WifiOff className="w-3 h-3 text-red-500" />
        )}
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>

      {/* LLM provider */}
      <div className="flex items-center gap-1">
        <Cpu className="w-3 h-3" />
        <span className="text-gray-300 font-medium">{llmProvider}</span>
      </div>

      {/* TTS provider */}
      <div className="flex items-center gap-1">
        <Volume2 className="w-3 h-3" />
        <span className="text-gray-300 font-medium">{ttsProvider}</span>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center gap-1.5 ml-auto">
          <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
}
