"use client";

import { X } from "lucide-react";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface ActiveFiltersProps {
  tags: string[];
  emotion: string | null;
  year: number | null;
  month: number | null;
  onRemoveTag: (tag: string) => void;
  onRemoveEmotion: () => void;
  onRemoveDate: () => void;
  onClearAll: () => void;
}

export function ActiveFilters({
  tags,
  emotion,
  year,
  month,
  onRemoveTag,
  onRemoveEmotion,
  onRemoveDate,
  onClearAll,
}: ActiveFiltersProps) {
  const hasFilters = tags.length > 0 || emotion || year;

  if (!hasFilters) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onRemoveTag(tag)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-accent/10 border border-accent/30 text-accent cursor-pointer hover:bg-accent/20"
          aria-label={`Remove filter: ${tag}`}
          type="button"
        >
          #{tag}
          <X className="w-3 h-3" />
        </button>
      ))}
      {emotion && (
        <button
          onClick={onRemoveEmotion}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-accent/10 border border-accent/30 text-accent cursor-pointer hover:bg-accent/20"
          aria-label="Remove emotion filter"
          type="button"
        >
          emotion: {emotion}
          <X className="w-3 h-3" />
        </button>
      )}
      {(year || month) && (
        <button
          onClick={onRemoveDate}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-accent/10 border border-accent/30 text-accent cursor-pointer hover:bg-accent/20"
          aria-label="Remove date filter"
          type="button"
        >
          {month ? `${MONTHS[month - 1]} ` : ""}{year}
          <X className="w-3 h-3" />
        </button>
      )}
      <button
        onClick={onClearAll}
        className="text-xs text-link hover:underline cursor-pointer ml-1"
        type="button"
      >
        Clear all
      </button>
    </div>
  );
}
