"use client";

import { useEffect, useState } from "react";
import { Heart, MessageCircle, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import {
  useReplies,
  useCreateComment,
  useDeleteComment,
  useToggleCommentLike,
  type CommentData,
} from "@/hooks/use-social";
import { useAuthStore } from "@/store/auth-store";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/social/report-button";
import Link from "next/link";

interface CommentItemProps {
  comment: CommentData;
  diaryId: string;
  parentAuthor?: string;
  parentContent?: string;
  isReply?: boolean;
  highlightCommentId?: string | null;
}

export function CommentItem({ comment, diaryId, parentAuthor, parentContent, isReply = false, highlightCommentId }: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.user);

  const [showAdminDeleteDialog, setShowAdminDeleteDialog] = useState(false);
  const [adminDeleteReason, setAdminDeleteReason] = useState("");

  useEffect(() => {
    if (highlightCommentId && !isReply && comment.reply_count > 0) {
      setShowReplies(true);
    }
  }, [highlightCommentId, comment.reply_count, isReply]);

  const createComment = useCreateComment(diaryId);
  const deleteComment = useDeleteComment(diaryId);
  const toggleCommentLike = useToggleCommentLike(comment.id);

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    try {
      await createComment.mutateAsync({ content: replyContent.trim(), parentId: comment.id });
      setReplyContent("");
      setShowReplyForm(false);
      setShowReplies(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [optimisticLiked, setOptimisticLiked] = useState(comment.is_liked);
  const [optimisticLikes, setOptimisticLikes] = useState(comment.like_count);

  const handleOptimisticLike = () => {
    const prevLiked = optimisticLiked;
    const prevLikes = optimisticLikes;
    setOptimisticLiked(!prevLiked);
    setOptimisticLikes(prevLiked ? prevLikes - 1 : prevLikes + 1);
    toggleCommentLike.mutate(undefined, {
      onError: () => {
        setOptimisticLiked(prevLiked);
        setOptimisticLikes(prevLikes);
      },
    });
  };

  const isAdminDelete = currentUser?.is_admin && !comment.is_owner && !comment.is_diary_owner;

  const handleDelete = () => {
    if (isAdminDelete) {
      setShowAdminDeleteDialog(true);
      return;
    }
    performDelete();
  };

  const performDelete = () => {
    setIsDeleted(true);
    deleteComment.mutate({ commentId: comment.id });
  };

  const handleAdminDeleteConfirm = () => {
    if (adminDeleteReason.trim().length < 10) return;
    setIsDeleted(true);
    deleteComment.mutate({ commentId: comment.id, reason: adminDeleteReason.trim() });
    setShowAdminDeleteDialog(false);
  };

  if (isDeleted || comment.is_deleted) return null;

  return (
    <>
    <div id={`comment-${comment.id}`}>
      <div className={isReply ? "ml-3 sm:ml-5 border-l-2 border-border/40 pl-3 sm:pl-4" : ""}>
        <div className="flex gap-2.5 py-2.5">
          <Avatar
            src={comment.author.avatar_path}
            alt={comment.author.username}
            size="sm"
            className="shrink-0"
          />
          <div className="flex-1 min-w-0">
            {parentAuthor && (
              <p className="text-xs text-subtle mb-0.5">
                Replying to{" "}
                <Link
                  href={`/profile/${parentAuthor}`}
                  className="text-link hover:underline"
                >
                  @{parentAuthor}
                </Link>
                {parentContent && (
                  <span className="text-subtle">
                    : {parentContent.length > 15
                      ? parentContent.slice(0, 15).trim() + "\u2026"
                      : parentContent}
                  </span>
                )}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-foreground">
                {comment.author.username}
              </span>
              <span className="text-xs text-subtle">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>

            <p className="text-sm mt-0.5 break-words leading-relaxed text-foreground">
              {comment.content}
            </p>

            <div className="flex items-center gap-3 mt-1.5">
              <button
                onClick={handleOptimisticLike}
                className="inline-flex items-center gap-1 text-xs text-subtle hover:text-accent cursor-pointer transition-colors"
                aria-label={optimisticLiked ? "Unlike comment" : "Like comment"}
              >
                <Heart
                  className={`w-3 h-3 ${
                    optimisticLiked ? "fill-red-500 text-red-500" : "fill-none"
                  }`}
                />
                {optimisticLikes > 0 && <span>{optimisticLikes}</span>}
              </button>

              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="inline-flex items-center gap-1 text-xs text-subtle hover:text-foreground cursor-pointer transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                Reply
              </button>

              {!comment.is_owner && isAuthenticated && <ReportButton targetType="comment" targetId={comment.id} />}

            {(comment.is_owner || comment.is_diary_owner || currentUser?.is_admin) && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 text-xs text-subtle hover:text-destructive cursor-pointer transition-colors"
                aria-label="Delete comment"
              >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {showReplyForm && (
              <div className="mt-2 flex gap-2">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Reply to @${comment.author.username}...`}
                  maxLength={2000}
                  rows={2}
                  className="flex-1 border border-border rounded-md bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-subtle resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  <Button variant="primary" size="sm" onClick={handleReply} disabled={!replyContent.trim() || isSubmitting}>
                    {isSubmitting ? "..." : "Reply"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowReplyForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {comment.reply_count > 0 && !showReplies && (
        <div className={isReply ? "ml-3 sm:ml-5 border-l-2 border-border/40 pl-3 sm:pl-4" : "ml-3 sm:ml-5"}>
          <button
            onClick={() => setShowReplies(true)}
            className="py-1 text-xs text-link hover:underline cursor-pointer inline-flex items-center gap-1"
          >
            <ChevronRight className="w-3 h-3" />
            View {comment.reply_count} {comment.reply_count === 1 ? "reply" : "replies"}
          </button>
        </div>
      )}

      {showReplies && (
        <RepliesList
          commentId={comment.id}
          diaryId={diaryId}
          parentAuthor={comment.author.username}
          parentContent={comment.content ?? undefined}
        />
      )}
    </div>

    {showAdminDeleteDialog && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdminDeleteDialog(false)}>
        <div className="bg-background border border-border p-4 w-80 max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-medium mb-2">Admin Comment Deletion</h3>
          <p className="text-xs text-muted mb-1">
            Deleting comment by <strong>@{comment.author.username}</strong>
          </p>
          <p className="text-xs text-muted mb-3">
            This action will be audit logged. Please provide a reason (min 10 characters).
          </p>
          <textarea
            value={adminDeleteReason}
            onChange={(e) => setAdminDeleteReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full border border-border bg-background text-xs p-2 text-foreground resize-none mb-3"
            placeholder="Reason for deletion..."
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAdminDeleteDialog(false); setAdminDeleteReason(""); }}
              className="text-xs px-3 py-1 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleAdminDeleteConfirm}
              disabled={adminDeleteReason.trim().length < 10 || deleteComment.isPending}
            >
              {deleteComment.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function RepliesList({
  commentId,
  diaryId,
  parentAuthor,
  parentContent,
}: {
  commentId: string;
  diaryId: string;
  parentAuthor: string;
  parentContent?: string;
}) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useReplies(commentId);
  const replies = data?.pages.flatMap((p) => p.data ?? []) ?? [];

  if (isLoading) {
    return (
      <div className="ml-3 sm:ml-5 border-l-2 border-border/30 pl-3 sm:pl-4 py-2">
        <span className="text-xs text-subtle">Loading replies...</span>
      </div>
    );
  }

  if (replies.length === 0) {
    return null;
  }

  return (
    <div>
      {replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          diaryId={diaryId}
          parentAuthor={parentAuthor}
          parentContent={parentContent}
          isReply
        />
      ))}
      {hasNextPage && (
        <div className="ml-3 sm:ml-5 border-l-2 border-border/30 pl-3 sm:pl-4 py-1">
          <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            <ChevronDown className="w-3 h-3" />
            {isFetchingNextPage ? "Loading..." : "Load more replies"}
          </Button>
        </div>
      )}
    </div>
  );
}
