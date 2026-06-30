"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Share2, Pencil, Trash2, Lock, Shield } from "lucide-react";

import { useDiary, useDeleteDiary } from "@/hooks/use-diaries";
import { useAuthStore } from "@/store/auth-store";
import { useMasterKey } from "@/hooks/use-master-key";
import { sanitizeHtml } from "@/lib/sanitize";
import { decryptDiary, type DiaryEncryptedPayload } from "@/lib/crypto";
import { Avatar } from "@/components/shared/avatar";
import { TagBadge } from "@/components/shared/tag-badge";
import { EmotionBadge } from "@/components/shared/emotion-badge";
import { WarningOverlay } from "@/components/diary/diary-warning-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LikeButton } from "@/components/social/like-button";
import { BookmarkButton } from "@/components/social/bookmark-button";
import { CommentSection } from "@/components/social/comment-section";

export default function DiaryReaderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: diary, isLoading, isError } = useDiary(id);
  const deleteDiary = useDeleteDiary();
  const user = useAuthStore((s) => s.user);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  const { masterKey, loadMasterKey, isAvailable: masterKeyAvailable, isLoading: isKeyLoading } = useMasterKey();

  const [passwordPrompt, setPasswordPrompt] = useState(false);
  const [decryptInput, setDecryptInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [decrypted, setDecrypted] = useState<{
    title: string;
    contentHtml: string;
    tags: string[];
  } | null>(null);
  const [decryptError, setDecryptError] = useState("");

  const isOwner = user?.id === diary?.author.id;
  const isPrivate = diary?.privacy === "private";

  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith("#comment-")) return;
    const commentId = hash.slice("#comment-".length);
    if (!commentId) return;

    const attemptScroll = (retries: number) => {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("comment-highlight");
        highlightTimer.current = setTimeout(() => {
          el.classList.remove("comment-highlight");
        }, 1500);
        return;
      }
      if (retries > 0) {
        setTimeout(() => attemptScroll(retries - 1), 300);
      }
    };
    attemptScroll(8);

    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [id, diary]);

  useEffect(() => {
    setWarningAcknowledged(false);
    setDecrypted(null);
    setDecryptError("");
    setDecryptInput("");
    setPasswordError("");
  }, [id]);

  useEffect(() => {
    if (diary?.content_warnings?.length && sessionStorage.getItem(`cw-${id}`) === "1") {
      setWarningAcknowledged(true);
    }
  }, [diary, id]);

  useEffect(() => {
    if (isPrivate && isOwner && diary && !decrypted && !decryptError) {
      if (!masterKey) {
        setPasswordPrompt(true);
        return;
      }
      const ed = diary as { encrypted_data?: DiaryEncryptedPayload };
      if (!ed.encrypted_data) {
        setDecryptError("No encrypted data found for this diary.");
        return;
      }
      decryptDiary(ed.encrypted_data, masterKey)
        .then((result) => {
          setDecrypted(result);
          setPasswordPrompt(false);
        })
        .catch(() => {
          setDecryptError(
            "The diary cannot be decrypted. This may happen if your password has changed since this diary was created."
          );
        });
    }
  }, [diary, isPrivate, isOwner, masterKey, decrypted, decryptError]);

  const handleKeyLoad = async () => {
    if (!decryptInput) return;
    setPasswordError("");
    try {
      await loadMasterKey(decryptInput);
    } catch {
      setPasswordError("Incorrect password or corrupted key data.");
    }
  };

  const handleAcknowledge = () => {
    sessionStorage.setItem(`cw-${id}`, "1");
    setWarningAcknowledged(true);
  };

  const title = useMemo(() => {
    if (isPrivate && isOwner) return decrypted?.title ?? "Decrypting...";
    return diary?.title ?? (isPrivate ? "Encrypted Diary" : "Untitled");
  }, [isPrivate, isOwner, decrypted, diary]);

  const displayHtml = useMemo(() => {
    if (isPrivate && isOwner) return decrypted?.contentHtml ?? "";
    return diary?.content_html ?? "";
  }, [isPrivate, isOwner, decrypted, diary]);

  const displayTags = useMemo(() => {
    if (isPrivate && isOwner) return decrypted?.tags ?? diary?.tags ?? [];
    return diary?.tags ?? [];
  }, [isPrivate, isOwner, decrypted, diary]);

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

  const showWarning = (diary.content_warnings?.length ?? 0) > 0 && !warningAcknowledged && !isOwner;

  const handleDelete = async () => {
    if (!confirm("Delete this diary permanently? This cannot be undone.")) return;
    try {
      await deleteDiary.mutateAsync(id);
      router.push("/me");
    } catch {
      // handled by mutation
    }
  };

  if (isPrivate && !isOwner) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <Lock className="w-8 h-8 text-muted mx-auto mb-4" />
        <h1 className="font-serif text-xl font-semibold text-foreground mb-2">
          Private Diary
        </h1>
        <p className="text-sm text-muted mb-4">
          This diary is private and can only be viewed by its owner.
        </p>
        <Link href="/" className="text-sm text-link hover:underline">
          Return home
        </Link>
      </div>
    );
  }

  if (isPrivate && isOwner && decryptError) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <Shield className="w-8 h-8 text-destructive mx-auto mb-4" />
        <h1 className="font-serif text-xl font-semibold text-foreground mb-2">
          Cannot Decrypt Diary
        </h1>
        <p className="text-sm text-muted mb-4">{decryptError}</p>
        <Link href="/me" className="text-sm text-link hover:underline">
          Go to My Diaries
        </Link>
      </div>
    );
  }

  return (
    <>
      {showWarning && diary.content_warnings && (
        <WarningOverlay
          warnings={diary.content_warnings}
          onAcknowledge={handleAcknowledge}
        />
      )}

      {passwordPrompt && isPrivate && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 bg-background border border-border rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-5 h-5 text-accent" />
              <h2 className="text-base font-semibold text-foreground">
                Enter Password to Decrypt
              </h2>
            </div>
            <p className="text-sm text-muted mb-4">
              This diary is end-to-end encrypted. Enter your account password to decrypt
              it in your browser.
            </p>
            <Input
              type="password"
              value={decryptInput}
              onChange={(e) => {
                setDecryptInput(e.target.value);
                setPasswordError("");
              }}
              placeholder="Your account password"
              className="mb-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleKeyLoad();
              }}
            />
            {passwordError && (
              <p className="text-xs text-destructive mb-2">{passwordError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <Link href="/me">
                <Button variant="secondary" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                disabled={!decryptInput || isKeyLoading}
                onClick={handleKeyLoad}
              >
                {isKeyLoading ? "Decrypting..." : "Decrypt"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto py-8 px-4">
      <Link
        href="/"
        className="text-xs text-muted hover:text-foreground no-underline hover:underline block mb-3"
      >
        &larr; Back
      </Link>

      {isPrivate && isOwner && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border border-border text-muted">
          <Lock className="w-3 h-3" />
          End-to-end encrypted
        </div>
      )}

      {diary.content_warnings && diary.content_warnings.length > 0 && !isOwner && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {diary.content_warnings.map((w: string) => (
            <span
              key={w}
              className="inline-block px-2 py-0.5 text-xs border border-border text-muted"
            >
              CW: {w}
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
        {title}
      </h1>

      {isPrivate && isOwner && !decrypted && !decryptError && (
        <div className="mt-6">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-2" />
          <Skeleton className="h-4 w-full" />
        </div>
      )}

      {(!isPrivate || (isPrivate && isOwner && decrypted)) && (
        <article
          className="mt-6 font-serif text-base leading-relaxed text-foreground max-w-prose [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-1 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_pre]:bg-tag-bg [&_pre]:text-foreground [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-sm [&_pre]:overflow-x-auto [&_code]:bg-tag-bg [&_code]:text-foreground [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_hr]:border-border [&_hr]:my-4 [&_style]:block"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(displayHtml) }}
        />
      )}

      {displayTags.length > 0 && (
        <div className="mt-8 flex gap-1.5 flex-wrap">
          {displayTags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}

      {!isPrivate && (
        <div className="mt-6 flex items-center gap-4">
          <LikeButton
            diaryId={id}
            initialCount={diary.stats.like_count}
            initialIsLiked={diary.is_liked}
          />
          <BookmarkButton
            diaryId={id}
            initialIsBookmarked={diary.is_bookmarked}
          />
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
      )}

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

      {!isPrivate && <CommentSection diaryId={id} />}
    </div>
    </>
  );
}