"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate_content", label: "Inappropriate Content" },
  { value: "harassment", label: "Harassment" },
  { value: "impersonation", label: "Impersonation" },
  { value: "copyright_violation", label: "Copyright Violation" },
  { value: "other", label: "Other" },
] as const;

interface ReportButtonProps {
  targetType: "diary" | "comment" | "user";
  targetId: string;
}

export function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      showToast("Please select a reason");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post("/reports", {
        target_type: targetType,
        target_id: targetId,
        reason,
        description: description.trim() || undefined,
      });
      showToast("Report submitted. Thank you.");
      setOpen(false);
      setReason("");
      setDescription("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || "Failed to submit report";
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    targetType === "diary" ? "Report Diary" : targetType === "comment" ? "Report Comment" : "Report User";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-subtle hover:text-accent cursor-pointer transition-colors"
        aria-label={`Report ${targetType}`}
      >
        <Flag className="w-3 h-3" />
        Report
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-80 max-w-[95vw] max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Select a reason for reporting this content.</DialogDescription>
          </DialogHeader>

          <fieldset className="space-y-1.5 my-2">
            <legend className="sr-only">Reason</legend>
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer border ${
                  reason === r.value
                    ? "border-foreground bg-overlay text-foreground"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={(e) => setReason(e.target.value)}
                  className="sr-only"
                />
                {r.label}
              </label>
            ))}
          </fieldset>

          <label htmlFor="report-description" className="text-xs text-muted block mb-1">
            Description (optional, max 2000 chars)
          </label>
          <textarea
            id="report-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full border border-border bg-background text-xs p-2 text-foreground resize-none"
            placeholder="Provide additional details..."
          />

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setOpen(false);
                setReason("");
                setDescription("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!reason || submitting}
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}