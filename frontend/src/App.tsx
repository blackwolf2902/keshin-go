import { Sparkles, User } from "lucide-react";
import { useChat } from "./hooks/useChat";
import { ChatPanel } from "./components/ChatPanel";
import { SubtitleOverlay } from "./components/SubtitleOverlay";
import { CharacterSelect } from "./components/CharacterSelect";
import { StatusBar } from "./components/StatusBar";
import "./styles/globals.css";

export default function App() {
  const {
    messages,
    characters,
    currentCharacter,
    health,
    isLoading,
    isStreaming,
    isDisabled,
    sendMessage,
    setCurrentCharacter,
  } = useChat();

  const lastCharMsg = [...messages]
    .reverse()
    .find((m) => m.role === "character");
  const currentSubtitle = lastCharMsg?.english_subtitle ?? "";
  const showSubtitle = currentSubtitle.length > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Keshin
          </h1>
          <CharacterSelect
            characters={characters}
            current={currentCharacter}
            onChange={setCurrentCharacter}
            disabled={isDisabled}
          />
        </div>
      </header>

      {/* Status bar */}
      <StatusBar
        health={health}
        characterVoice={currentCharacter?.voice}
        isLoading={isLoading}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat panel (left side) */}
        <div className="w-full lg:w-1/2 xl:w-2/5 border-r border-gray-700 flex flex-col">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            isStreaming={isStreaming}
            onSend={sendMessage}
            characterName={currentCharacter?.name ?? "Character"}
          />
        </div>

        {/* 3D character placeholder (right side) */}
        <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-850 relative">
          <div className="text-center text-gray-500">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                <User className="w-10 h-10 text-gray-600" />
              </div>
            </div>
            <p className="text-lg font-medium">3D Character</p>
            <p className="text-sm text-gray-600">Coming in Phase 1B</p>
          </div>

          {/* Subtitle overlay */}
          <SubtitleOverlay text={currentSubtitle} visible={showSubtitle} />
        </div>
      </div>
    </div>
  );
}
