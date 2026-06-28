"use client";

import { useState } from "react";
import { Heart, MessageCircle, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import {
  useReplies,
  useCreateComment,
  useDeleteComment,
  useToggleCommentLike,
  type CommentData,
} from "@/hooks/use-social";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";

const MAX_VISIBLE_DEPTH = 4;

interface CommentItemProps {
  comment: CommentData;
  diaryId: string;
  depth?: number;
}

export function CommentItem({ comment, diaryId, depth = 0 }: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

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

  const handleDelete = () => {
    setIsDeleted(true);
    deleteComment.mutate(comment.id);
  };

  const effectiveDepth = depth >= MAX_VISIBLE_DEPTH ? MAX_VISIBLE_DEPTH : depth;
  const connectorColor = depth >= MAX_VISIBLE_DEPTH ? "border-subtle/40" : "border-border";
  const isEffectivelyDeleted = isDeleted || comment.is_deleted;

  return (
    <div className={`${effectiveDepth > 0 ? `ml-3 sm:ml-6 border-l-2 ${connectorColor} pl-3 sm:pl-4` : ""}`}>
      <div className="flex gap-2.5 py-2.5">
        <Avatar
          src={comment.author.avatar_path}
          alt={isEffectivelyDeleted ? "deleted" : comment.author.username}
          size="sm"
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-foreground">
              {isEffectivelyDeleted ? "[deleted]" : comment.author.username}
            </span>
            <span className="text-xs text-subtle">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
            {isEffectivelyDeleted && (
              <span className="text-xs italic text-muted">deleted</span>
            )}
          </div>

          <p className={`text-sm mt-0.5 break-words leading-relaxed ${isEffectivelyDeleted ? "italic text-muted" : "text-foreground"}`}>
            {isEffectivelyDeleted ? "[deleted]" : comment.content}
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

            {!isEffectivelyDeleted && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="inline-flex items-center gap-1 text-xs text-subtle hover:text-foreground cursor-pointer transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                Reply
              </button>
            )}

            {(comment.is_owner || comment.is_diary_owner) && !isEffectivelyDeleted && (
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
                placeholder="Write a reply..."
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

      {comment.reply_count > 0 && !showReplies && (
        <button
          onClick={() => setShowReplies(true)}
          className="ml-3 sm:ml-6 mb-2 text-xs text-link hover:underline cursor-pointer inline-flex items-center gap-1"
        >
          <ChevronRight className="w-3 h-3" />
          View {comment.reply_count} {comment.reply_count === 1 ? "reply" : "replies"}
        </button>
      )}

      {showReplies && (
        <RepliesList commentId={comment.id} diaryId={diaryId} depth={depth + 1} />
      )}
    </div>
  );
}

function RepliesList({ commentId, diaryId, depth }: { commentId: string; diaryId: string; depth: number }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useReplies(commentId);
  const replies = data?.pages.flatMap((p) => p.data ?? []) ?? [];

  if (isLoading) {
    return (
      <div className="ml-3 sm:ml-6 border-l-2 border-border/30 pl-3 py-2">
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
        <CommentItem key={reply.id} comment={reply} diaryId={diaryId} depth={depth} />
      ))}
      {hasNextPage && (
        <div className="ml-3 sm:ml-6 mt-1 mb-2">
          <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            <ChevronDown className="w-3 h-3" />
            {isFetchingNextPage ? "Loading..." : "Load more replies"}
          </Button>
        </div>
      )}
    </div>
  );
}
