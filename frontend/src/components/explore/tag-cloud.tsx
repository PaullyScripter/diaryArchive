"use client";

interface TagCloudProps {
  tags: Array<{ tag: string; count: number }>;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  maxTags?: number;
}

function scaleSize(count: number, minCount: number, maxCount: number): string {
  if (maxCount === minCount) return "0.875rem";
  const minSize = 0.75;
  const maxSize = 1.25;
  const ratio = (count - minCount) / (maxCount - minCount);
  const size = minSize + ratio * (maxSize - minSize);
  return `${size.toFixed(2)}rem`;
}

function scaleOpacity(count: number, minCount: number, maxCount: number): number {
  if (maxCount === minCount) return 0.75;
  const ratio = (count - minCount) / (maxCount - minCount);
  return 0.5 + ratio * 0.5;
}

export function TagCloud({ tags, selectedTags, onToggleTag, maxTags = 50 }: TagCloudProps) {
  const displayTags = tags.slice(0, maxTags);
  const counts = displayTags.map((t) => t.count);
  const minCount = Math.min(...counts, 1);
  const maxCount = Math.max(...counts, 1);

  if (displayTags.length === 0) {
    return (
      <p className="text-xs text-muted text-center py-4">
        No tags yet. Tags appear as people write.
      </p>
    );
  }

  return (
    <div className="flex gap-1.5 flex-wrap" role="list" aria-label="Tag cloud">
      {displayTags.map(({ tag, count }) => {
        const isSelected = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onToggleTag(tag)}
            role="listitem"
            aria-pressed={isSelected}
            className={`inline-block px-2 py-0.5 rounded-sm cursor-pointer transition-colors border ${
              isSelected
                ? "bg-accent/10 border-accent text-accent"
                : "border-border text-muted hover:text-foreground hover:border-foreground/30"
            }`}
            style={{
              fontSize: scaleSize(count, minCount, maxCount),
              opacity: isSelected ? 1 : scaleOpacity(count, minCount, maxCount),
            }}
          >
            #{tag}
          </button>
        );
      })}
    </div>
  );
}
