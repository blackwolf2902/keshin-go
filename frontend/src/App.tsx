import { useChat } from "./hooks/useChat";
import { ChatPanel } from "./components/ChatPanel";
import { CharacterViewer } from "./components/CharacterViewer";
import { SubtitleOverlay } from "./components/SubtitleOverlay";
import { AudioPlayer } from "./components/AudioPlayer";
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

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Left: 3D Character Viewer */}
      <div className="w-3/5 relative flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white">Keshin</h1>
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

        {/* 3D Character */}
        <div className="flex-1 relative">
          <CharacterViewer className="w-full h-full" />
          <SubtitleOverlay />
        </div>
      </div>

      {/* Right: Chat Panel */}
      <div className="w-2/5 flex flex-col border-l border-gray-800">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onSend={sendMessage}
          characterName={currentCharacter?.name ?? "Character"}
        />
      </div>

      {/* Hidden audio player */}
      <AudioPlayer />
    </div>
  );
}
