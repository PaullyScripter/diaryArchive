import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { TagBadge } from "@/components/shared/tag-badge";
import { EmotionBadge } from "@/components/shared/emotion-badge";
import { PrivacyBadge } from "@/components/shared/privacy-badge";

export interface DiaryCardData {
  id: string;
  title: string | null;
  excerpt: string | null;
  author: {
    id: string;
    username: string;
    avatar_path: string | null;
  };
  tags: string[];
  emotion: string | null;
  stats: {
    like_count: number;
    comment_count: number;
    bookmark_count: number;
  };
  privacy?: string;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}wk ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function DiaryCard({ diary }: { diary: DiaryCardData }) {
  return (
    <article className="p-4 border border-border rounded-lg bg-background hover:border-foreground/20 transition-colors flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {diary.privacy && <PrivacyBadge privacy={diary.privacy} />}
        {diary.emotion && <EmotionBadge emotion={diary.emotion} />}
      </div>

      <Link
        href={`/diary/${diary.id}`}
        className="font-serif text-lg font-semibold text-foreground leading-snug no-underline hover:underline line-clamp-2"
      >
        {diary.title ?? (diary.privacy === "private" ? "Private Entry" : "Untitled")}
      </Link>

      {diary.excerpt && (
        <p className="text-xs text-muted leading-snug line-clamp-3">
          {diary.excerpt}
        </p>
      )}

      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex items-center gap-2 text-xs text-muted min-w-0">
          <Link
            href={`/profile/${diary.author.username}`}
            className="text-muted hover:text-foreground no-underline hover:underline truncate"
          >
            {diary.author.username}
          </Link>
          <span className="text-subtle">·</span>
          <span className="text-subtle whitespace-nowrap">
            {relativeTime(diary.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-subtle">
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />
            {diary.stats.like_count}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            {diary.stats.comment_count}
          </span>
        </div>
      </div>

      {diary.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {diary.tags.slice(0, 5).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}
    </article>
  );
}
