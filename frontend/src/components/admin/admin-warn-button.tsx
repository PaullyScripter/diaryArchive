"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Hammer } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/shared/toast";

interface AdminWarnButtonProps {
  userId: string;
  username: string;
  className?: string;
}

export function AdminWarnButton({ userId, username, className = "" }: AdminWarnButtonProps) {
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [warningType, setWarningType] = useState<"bio" | "username">("bio");
  const [reason, setReason] = useState("");

  if (!currentUser?.is_admin) return null;

  const warnMutation = useMutation({
    mutationFn: async () => {
      const endpoint = warningType === "bio" ? "/admin/warnings/bio" : "/admin/warnings/username";
      await apiClient.post(endpoint, { user_id: userId, reason: reason.trim() });
    },
    onSuccess: () => {
      showToast(`${warningType === "bio" ? "Bio" : "Username"} warning sent to @${username}`);
      setOpen(false);
      setReason("");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || "Failed to issue warning";
      showToast(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) return;
    warnMutation.mutate();
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        className={`text-muted hover:text-accent cursor-pointer bg-transparent border-0 ${className}`}
        title="Warn user"
        type="button"
      >
        <Hammer className="w-4 h-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Warn @{username}</DialogTitle>
            <DialogDescription>Issue a content or username warning to this user.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWarningType("bio")}
                className={`text-xs px-3 py-1 border-0 cursor-pointer ${
                  warningType === "bio" ? "bg-foreground text-background" : "bg-overlay text-muted hover:text-foreground"
                }`}
              >
                Bio warning
              </button>
              <button
                type="button"
                onClick={() => setWarningType("username")}
                className={`text-xs px-3 py-1 border-0 cursor-pointer ${
                  warningType === "username" ? "bg-foreground text-background" : "bg-overlay text-muted hover:text-foreground"
                }`}
              >
                Username warning
              </button>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border border-border bg-background text-sm p-2 text-foreground resize-none"
              placeholder={
                warningType === "bio"
                  ? "Explain why the bio is inappropriate..."
                  : "Explain why the username is inappropriate..."
              }
              disabled={warnMutation.isPending}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={warnMutation.isPending || reason.trim().length < 5}>
                {warnMutation.isPending ? "Sending..." : "Send warning"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
