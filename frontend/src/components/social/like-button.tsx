"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useToggleLike } from "@/hooks/use-social";

interface LikeButtonProps {
  diaryId: string;
  initialCount: number;
  initialIsLiked: boolean;
}

export function LikeButton({ diaryId, initialCount, initialIsLiked }: LikeButtonProps) {
  const [optimisticIsLiked, setOptimisticIsLiked] = useState(initialIsLiked);
  const [optimisticCount, setOptimisticCount] = useState(initialCount);
  const toggleLike = useToggleLike(diaryId);

  const handleToggle = () => {
    const prevLiked = optimisticIsLiked;
    const prevCount = optimisticCount;
    setOptimisticIsLiked(!prevLiked);
    setOptimisticCount(prevLiked ? prevCount - 1 : prevCount + 1);

    toggleLike.mutate(undefined, {
      onError: () => {
        setOptimisticIsLiked(prevLiked);
        setOptimisticCount(prevCount);
      },
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={toggleLike.isPending}
      className="inline-flex items-center gap-1 text-xs text-subtle hover:text-foreground cursor-pointer transition-colors disabled:opacity-50"
      aria-pressed={optimisticIsLiked}
      aria-label={`Like (${optimisticCount})`}
    >
      <Heart
        className={`w-4 h-4 transition-all ${
          optimisticIsLiked
            ? "fill-red-500 text-red-500 scale-110"
            : "fill-none"
        }`}
      />
      <span>{optimisticCount}</span>
    </button>
  );
}
