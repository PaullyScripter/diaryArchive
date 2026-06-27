"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Bookmark, Share2, Pencil, Trash2 } from "lucide-react";

import { useDiary, useDeleteDiary } from "@/hooks/use-diaries";
import { useAuthStore } from "@/store/auth-store";
import { Avatar } from "@/components/shared/avatar";
import { TagBadge } from "@/components/shared/tag-badge";
import { EmotionBadge } from "@/components/shared/emotion-badge";
import { WarningOverlay } from "@/components/diary/diary-warning-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function DiaryReaderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: diary, isLoading, isError } = useDiary(id);
  const deleteDiary = useDeleteDiary();
  const user = useAuthStore((s) => s.user);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  useEffect(() => {
    setWarningAcknowledged(false);
  }, [id]);

  useEffect(() => {
    if (diary?.content_warnings?.length && sessionStorage.getItem(`cw-${id}`) === "1") {
      setWarningAcknowledged(true);
    }
  }, [diary, id]);

  const handleAcknowledge = () => {
    sessionStorage.setItem(`cw-${id}`, "1");
    setWarningAcknowledged(true);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-24 mb-6" />
        <Skeleton className="h-6 w-full mb-2" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !diary) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <h1 className="font-serif text-xl font-semibold text-foreground mb-2">
          Diary not found
        </h1>
        <p className="text-sm text-muted mb-4">
          This diary doesn&apos;t exist or has been removed.
        </p>
        <Link href="/" className="text-sm text-link hover:underline">
          Return home
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === diary.author.id;

  const showWarning = diary.content_warnings?.length && !warningAcknowledged && !isOwner;

  const handleDelete = async () => {
    if (!confirm("Delete this diary permanently? This cannot be undone.")) return;
    try {
      await deleteDiary.mutateAsync(id);
      router.push("/me");
    } catch {
      // handled by mutation
    }
  };

  return (
    <>
      {showWarning && diary.content_warnings && (
        <WarningOverlay
          warnings={diary.content_warnings}
          onAcknowledge={handleAcknowledge}
        />
      )}
      <div className="max-w-2xl mx-auto py-8 px-4">
      <Link
        href="/"
        className="text-xs text-muted hover:text-foreground no-underline hover:underline"
      >
        &larr; Back
      </Link>

      {diary.content_warnings && diary.content_warnings.length > 0 && !isOwner && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {diary.content_warnings.map((w: string) => (
            <span
              key={w}
              className="inline-block px-2 py-0.5 text-[11px] font-[system-ui] bg-[#c0c0c0] text-[#000] border border-[#808080] shadow-[inset_1px_1px_0_#fff,inset_-1px_-1px_0_#808080]"
            >
              ⚠ {w}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Link href={`/profile/${diary.author.username}`}>
          <Avatar
            src={diary.author.avatar_path}
            alt={diary.author.username}
            size="md"
          />
        </Link>
        <div>
          <Link
            href={`/profile/${diary.author.username}`}
            className="text-sm font-medium text-foreground no-underline hover:underline"
          >
            {diary.author.username}
          </Link>
          <div className="flex items-center gap-1 text-xs text-subtle">
            <time dateTime={diary.created_at}>
              {new Date(diary.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
            {diary.emotion && (
              <>
                <span>·</span>
                <EmotionBadge emotion={diary.emotion} />
              </>
            )}
          </div>
        </div>
      </div>

      <h1 className="mt-6 font-serif text-2xl font-bold text-foreground leading-tight">
        {diary.title ?? "Untitled"}
      </h1>

      <article
        className="mt-6 font-serif text-base leading-relaxed text-foreground max-w-prose"
        dangerouslySetInnerHTML={{ __html: diary.content_html ?? "" }}
      />

      {diary.tags.length > 0 && (
        <div className="mt-8 flex gap-1.5 flex-wrap">
          {diary.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" disabled title="Likes coming in a future update">
          <Heart className="w-4 h-4" />
          <span className="text-xs">{diary.stats.like_count}</span>
        </Button>
        <Button variant="ghost" size="sm" disabled title="Bookmarks coming in a future update">
          <Bookmark className="w-4 h-4" />
          <span className="text-xs">{diary.stats.bookmark_count}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
          }}
        >
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      {isOwner && (
        <div className="mt-6 pt-4 border-t border-border flex gap-2">
          <Link href={`/diary/${id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteDiary.isPending}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleteDiary.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-border">
        <h2 className="text-sm font-medium text-foreground mb-3">
          Comments ({diary.stats.comment_count})
        </h2>
        <p className="text-xs text-muted">
          Comments will be available in a future update.
        </p>
      </div>
    </div>
    </>
  );
}
