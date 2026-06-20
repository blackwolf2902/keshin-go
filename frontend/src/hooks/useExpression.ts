import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useCharacterStore } from '../stores/characterStore';
import { VRMExpressionManager } from '../renderers/vrm/VRMExpressionManager';
import type { EmotionName } from '../renderers/vrm/types';

// Map LLM emotion strings to VRM expression names
const EMOTION_TO_EXPRESSION: Record<string, EmotionName> = {
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  surprised: 'surprised',
  thinking: 'thinking',
  neutral: 'neutral',
  // Common variations
  joy: 'happy',
  joyfull: 'happy',
  excited: 'happy',
  confused: 'thinking',
  curious: 'thinking',
  embarrassed: 'surprised',
  shy: 'surprised',
  scared: 'sad',
  worried: 'sad',
  content: 'happy',
  playful: 'happy',
};

/**
 * Normalize an emotion string from LLM output to a valid EmotionName.
 */
function normalizeEmotion(emotion: string): EmotionName {
  const lower = emotion.toLowerCase().trim();
  return EMOTION_TO_EXPRESSION[lower] ?? 'neutral';
}

/**
 * Hook that watches for emotion changes in the chat store
 * and applies them to the VRM expression manager.
 */
export function useExpression(expressionManager: VRMExpressionManager | null) {
  const messages = useChatStore((s) => s.messages);
  const setExpression = useCharacterStore((s) => s.setExpression);
  const lastMessageIdRef = useRef<string>('');

  // Watch for new assistant messages with emotion
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.id === lastMessageIdRef.current) return;
    if (lastMessage.role !== 'character') return;

    lastMessageIdRef.current = lastMessage.id;

    if (lastMessage.emotion) {
      const expression = normalizeEmotion(lastMessage.emotion);
      expressionManager?.setExpression(expression);
      setExpression(expression);
    }
  }, [messages, expressionManager, setExpression]);

  // Return expression to neutral when chat is idle (no new messages for 5s)
  useEffect(() => {
    if (messages.length === 0) return;

    const timer = setTimeout(() => {
      expressionManager?.setExpression('neutral');
      setExpression('neutral');
    }, 5000);

    return () => clearTimeout(timer);
  }, [messages, expressionManager, setExpression]);
}
