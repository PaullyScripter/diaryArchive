"use client";

const EMOTION_MAP: Record<string, { emoji: string; label: string }> = {
  happy: { emoji: "\uD83D\uDE0A", label: "Happy" },
  sad: { emoji: "\uD83D\uDE22", label: "Sad" },
  hopeful: { emoji: "\u2601\uFE0F", label: "Hopeful" },
  reflective: { emoji: "\uD83E\uDE9E", label: "Reflective" },
  angry: { emoji: "\uD83D\uDE24", label: "Angry" },
  anxious: { emoji: "\uD83D\uDE30", label: "Anxious" },
  grateful: { emoji: "\uD83D\uDE4F", label: "Grateful" },
  excited: { emoji: "\uD83C\uDF89", label: "Excited" },
  tired: { emoji: "\uD83D\uDE34", label: "Tired" },
  lonely: { emoji: "\uD83C\uDF27\uFE0F", label: "Lonely" },
  nostalgic: { emoji: "\uD83D\uDD6E\uFE0F", label: "Nostalgic" },
  neutral: { emoji: "\uD83D\uDE10", label: "Neutral" },
};

interface EmotionBrowserProps {
  emotions: Array<{ emotion: string; count: number }>;
  selectedEmotion: string | null;
  onSelectEmotion: (emotion: string | null) => void;
}

export function EmotionBrowser({ emotions, selectedEmotion, onSelectEmotion }: EmotionBrowserProps) {
  const emotionEntries = emotions.filter((e) => EMOTION_MAP[e.emotion]);

  if (emotionEntries.length === 0) {
    return (
      <p className="text-xs text-muted text-center py-4">
        No emotions recorded yet.
      </p>
    );
  }

  return (
    <div role="radiogroup" aria-label="Filter by emotion" className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      <button
        onClick={() => onSelectEmotion(null)}
        role="radio"
        aria-checked={selectedEmotion === null}
        className={`flex flex-col items-center gap-1 p-2 rounded-md border cursor-pointer transition-colors ${
          selectedEmotion === null
            ? "bg-accent/10 border-accent"
            : "border-border hover:border-foreground/30"
        }`}
        type="button"
      >
        <span className="text-xl">All</span>
        <span className="text-xs text-foreground font-medium">All</span>
      </button>
      {emotionEntries.map(({ emotion, count }) => {
        const em = EMOTION_MAP[emotion];
        const isSelected = selectedEmotion === emotion;
        return (
          <button
            key={emotion}
            onClick={() => onSelectEmotion(isSelected ? null : emotion)}
            role="radio"
            aria-checked={isSelected}
            className={`flex flex-col items-center gap-1 p-2 rounded-md border cursor-pointer transition-colors ${
              isSelected
                ? "bg-accent/10 border-accent"
                : "border-border hover:border-foreground/30"
            }`}
            type="button"
          >
            <span className="text-xl">{em.emoji}</span>
            <span className="text-xs text-foreground">{em.label}</span>
            <span className="text-[10px] text-subtle">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
