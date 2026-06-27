const EMOTION_SUGGESTIONS = [
  "happy", "sad", "anxious", "angry", "excited",
  "grateful", "lonely", "hopeful", "nostalgic", "reflective",
  "neutral", "melancholy", "peaceful", "tired", "energetic",
  "curious", "frustrated", "content", "overwhelmed", "loved",
];

export { EMOTION_SUGGESTIONS };

export function EmotionBadge({ emotion }: { emotion: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-accent-soft text-accent">
      {emotion}
    </span>
  );
}
