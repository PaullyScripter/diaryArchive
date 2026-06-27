const EMOTION_SUGGESTIONS = [
  "happy", "sad", "anxious", "angry", "excited",
  "grateful", "lonely", "hopeful", "nostalgic", "reflective",
  "neutral", "melancholy", "peaceful", "tired", "energetic",
  "curious", "frustrated", "content", "overwhelmed", "loved",
];

export { EMOTION_SUGGESTIONS };

export function EmotionBadge({ emotion }: { emotion: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-[hsl(15,30%,92%)] text-[hsl(15,40%,54%)] dark:bg-[hsl(15,25%,26%)] dark:text-[hsl(15,55%,72%)]">
      {emotion}
    </span>
  );
}
