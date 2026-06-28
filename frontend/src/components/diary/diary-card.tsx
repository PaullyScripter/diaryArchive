import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { TagBadge } from "@/components/shared/tag-badge";
import { PrivacyBadge } from "@/components/shared/privacy-badge";
import { relativeTime } from "@/lib/utils";

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
  content_warnings?: string[];
  encrypted_data?: {
    ciphertext: string;
    iv: string;
    salt: string;
  } | null;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
}

export function DiaryCard({ diary }: { diary: DiaryCardData }) {
  return (
    <article className="py-3 border-b border-border last:border-b-0 border-l-2 border-l-accent transition-colors hover:bg-overlay -mx-4 px-4 rounded-sm">
      <div className="max-w-prose">
        <Link
          href={`/diary/${diary.id}`}
          className="text-lg font-serif font-semibold text-foreground leading-snug no-underline hover:underline"
        >
          {diary.title ?? (diary.privacy === "private" ? "Private Entry" : "Untitled")}
        </Link>

        <div className="mt-0.5 text-xs text-subtle">
          <Link
            href={`/profile/${diary.author.username}`}
            className="text-muted hover:text-foreground no-underline hover:underline"
          >
            {diary.author.username}
          </Link>
          <span className="mx-1">·</span>
          <span>{relativeTime(diary.created_at)}</span>
          {diary.emotion && (
            <>
              <span className="mx-1">·</span>
              <span className="text-[hsl(15,40%,54%)] dark:text-[hsl(15,55%,72%)] font-medium">{diary.emotion}</span>
            </>
          )}
          {diary.content_warnings && diary.content_warnings.length > 0 && (
            <>
              <span className="mx-1">·</span>
              <span className="text-subtle text-[11px]" title={diary.content_warnings.join(", ")}>⚠</span>
            </>
          )}
          {diary.privacy && (
            <>
              <span className="mx-1">·</span>
              <PrivacyBadge privacy={diary.privacy} />
            </>
          )}
        </div>

        {diary.tags.length > 0 && (
          <div className="mt-1 text-xs">
            {diary.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}{" "}
          </div>
        )}

        {diary.excerpt && (
          <p className="mt-2 text-xs text-muted leading-snug line-clamp-2">
            {diary.excerpt}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-3 text-xs text-subtle">
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
    </article>
  );
}
