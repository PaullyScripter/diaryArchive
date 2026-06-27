const EMOTION_EMOJI: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  anxious: "😰",
  angry: "😤",
  excited: "🎉",
  grateful: "🙏",
  lonely: "🥀",
  hopeful: "🌅",
  nostalgic: "📻",
  reflective: "🤔",
  neutral: "😐",
};

export function getEmotionEmoji(emotion: string): string {
  return EMOTION_EMOJI[emotion] ?? "";
}

export function EmotionBadge({ emotion }: { emotion: string }) {
  const emoji = getEmotionEmoji(emotion);
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-accent-soft text-accent">
      {emoji && <span className="text-xs leading-none">{emoji}</span>}
      {emotion}
    </span>
  );
}
