"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate_content", label: "Inappropriate Content" },
  { value: "harassment", label: "Harassment" },
  { value: "impersonation", label: "Impersonation" },
  { value: "copyright_violation", label: "Copyright Violation" },
  { value: "other", label: "Other" },
] as const;

interface ReportButtonProps {
  targetType: "diary" | "comment";
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

      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background border border-border p-4 w-80 max-w-[95vw] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-3">
              Report {targetType === "diary" ? "Diary" : "Comment"}
            </h3>

            <div className="space-y-1.5 mb-3">
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
            </div>

            <label className="text-xs text-muted block mb-1">
              Description (optional, max 1000 chars)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full border border-border bg-background text-xs p-2 text-foreground resize-none mb-3"
              placeholder="Provide additional details..."
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setOpen(false);
                  setReason("");
                  setDescription("");
                }}
                className="text-xs px-3 py-1 border border-border cursor-pointer bg-transparent text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!reason || submitting}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
