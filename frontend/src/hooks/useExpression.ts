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
  // Also subscribe directly to currentEmotion — this updates as soon as the emotion SSE event fires
  const currentEmotion = useChatStore((s) => s.currentEmotion);
  const setExpression = useCharacterStore((s) => s.setExpression);

  // Derive the latest character emotion from messages (populated by updateLastMessage)
  const lastMessage = messages[messages.length - 1];
  const lastCharacterEmotion =
    lastMessage?.role === 'character' ? (lastMessage.emotion ?? null) : null;

  // Track the last applied emotion to avoid re-applying the same expression
  const lastAppliedEmotionRef = useRef<string>('');

  // PRIMARY: React to chatStore.currentEmotion (updated immediately when emotion SSE fires)
  useEffect(() => {
    if (!currentEmotion || currentEmotion === 'neutral') return;
    if (currentEmotion === lastAppliedEmotionRef.current) return;

    lastAppliedEmotionRef.current = currentEmotion;
    const expression = normalizeEmotion(currentEmotion);
    expressionManager?.setExpression(expression);
    setExpression(expression);
  }, [currentEmotion, expressionManager, setExpression]);

  // FALLBACK: Also react when the last message's emotion field is updated (for non-stream path)
  useEffect(() => {
    if (!lastCharacterEmotion) return;
    if (lastCharacterEmotion === lastAppliedEmotionRef.current) return;

    lastAppliedEmotionRef.current = lastCharacterEmotion;
    const expression = normalizeEmotion(lastCharacterEmotion);
    expressionManager?.setExpression(expression);
    setExpression(expression);
  }, [lastCharacterEmotion, expressionManager, setExpression]);

  // Return expression to neutral when a new user turn begins
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role !== 'user') return;

    // A new user message means the character finished speaking — reset after a delay
    const timer = setTimeout(() => {
      lastAppliedEmotionRef.current = 'neutral';
      expressionManager?.setExpression('neutral');
      setExpression('neutral');
    }, 500);

    return () => clearTimeout(timer);
  }, [messages, expressionManager, setExpression]);
}
