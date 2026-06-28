"use client";

import { useState } from "react";
import { useComments, useCreateComment } from "@/hooks/use-social";
import { useAuthStore } from "@/store/auth-store";
import { CommentItem } from "@/components/social/comment-item";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CommentSection({ diaryId }: { diaryId: string }) {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useComments(diaryId);
  const createComment = useCreateComment(diaryId);

  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const comments = data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const total = data?.pages[0]?.meta?.total ?? 0;

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      await createComment.mutateAsync({ content: content.trim() });
      setContent("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h2 className="text-sm font-medium text-foreground mb-3">
        Comments ({total})
      </h2>

      {user && (
        <div className="flex items-start gap-3 mb-6">
          <Avatar src={user.avatar_path} alt={user.username} size="sm" />
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a comment..."
              maxLength={2000}
              rows={2}
              className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground placeholder:text-subtle resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-subtle">
                {content.length}/2000
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted text-center py-4">
          No comments yet. Be the first to share your thoughts.
        </p>
      ) : (
        <div className="space-y-0">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} diaryId={diaryId} />
          ))}

          {hasNextPage && (
            <div className="text-center mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading..." : "Load more comments"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
