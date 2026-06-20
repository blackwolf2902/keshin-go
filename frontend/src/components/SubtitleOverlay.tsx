interface SubtitleOverlayProps {
  text: string;
  visible: boolean;
}

export function SubtitleOverlay({ text, visible }: SubtitleOverlayProps) {
  if (!visible || !text) return null;

  return (
    <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none z-10">
      <div className="subtitle-overlay transition-opacity duration-500 animate-fadeIn">
        {text}
      </div>
    </div>
  );
}
