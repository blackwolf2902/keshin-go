import { useChatStore } from "../stores/chatStore";

export function SubtitleOverlay() {
  const messages = useChatStore((s) => s.messages);
  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === "character");

  const text = lastAssistantMsg?.english_subtitle ?? "";
  if (!text) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 flex justify-center pointer-events-none z-10">
      <div
        className="bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-lg
                      text-center text-lg max-w-xl
                      animate-fade-in shadow-lg subtitle-bar"
      >
        {text}
      </div>
    </div>
  );
}
