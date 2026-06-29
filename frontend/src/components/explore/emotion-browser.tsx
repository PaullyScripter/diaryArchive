"use client";

const EMOTION_MAP: Record<string, { label: string }> = {
  happy: { label: "Happy" },
  sad: { label: "Sad" },
  hopeful: { label: "Hopeful" },
  reflective: { label: "Reflective" },
  angry: { label: "Angry" },
  anxious: { label: "Anxious" },
  grateful: { label: "Grateful" },
  excited: { label: "Excited" },
  tired: { label: "Tired" },
  lonely: { label: "Lonely" },
  nostalgic: { label: "Nostalgic" },
  neutral: { label: "Neutral" },
  melancholy: { label: "Melancholy" },
  peaceful: { label: "Peaceful" },
  energetic: { label: "Energetic" },
  curious: { label: "Curious" },
  frustrated: { label: "Frustrated" },
  content: { label: "Content" },
  overwhelmed: { label: "Overwhelmed" },
  loved: { label: "Loved" },
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
        <span className="text-sm font-medium text-foreground">All</span>
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
            <span className="text-sm font-medium text-foreground">{em.label}</span>
            <span className="text-[10px] text-subtle">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
