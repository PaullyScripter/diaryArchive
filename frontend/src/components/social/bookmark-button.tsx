"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { useToggleBookmark } from "@/hooks/use-social";

interface BookmarkButtonProps {
  diaryId: string;
  initialIsBookmarked: boolean;
}

export function BookmarkButton({ diaryId, initialIsBookmarked }: BookmarkButtonProps) {
  const [optimisticIsBookmarked, setOptimisticIsBookmarked] = useState(initialIsBookmarked);
  const toggleBookmark = useToggleBookmark(diaryId);

  const handleToggle = () => {
    const prev = optimisticIsBookmarked;
    setOptimisticIsBookmarked(!prev);

    toggleBookmark.mutate(undefined, {
      onError: () => {
        setOptimisticIsBookmarked(prev);
      },
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={toggleBookmark.isPending}
      className="inline-flex items-center gap-1 text-xs text-subtle hover:text-foreground cursor-pointer transition-colors disabled:opacity-50"
      aria-pressed={optimisticIsBookmarked}
      aria-label={optimisticIsBookmarked ? "Remove bookmark" : "Bookmark"}
    >
      <Bookmark
        className={`w-4 h-4 transition-all ${
          optimisticIsBookmarked
            ? "fill-foreground text-foreground"
            : "fill-none"
        }`}
      />
    </button>
  );
}
