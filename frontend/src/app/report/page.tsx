"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { showToast } from "@/components/shared/toast";

const TICKET_CATEGORIES = [
  { value: "account_help", label: "Account Help" },
  { value: "username_change", label: "Username Change" },
  { value: "general_inquiry", label: "General Inquiry" },
  { value: "feature_request", label: "Feature Request" },
  { value: "report_problem", label: "Report a Problem" },
] as const;

const PROFILE_REASONS = [
  { label: "Inappropriate bio/about", value: "inappropriate_content" },
  { label: "Inappropriate username", value: "inappropriate_content" },
  { label: "Impersonation", value: "impersonation" },
  { label: "Spam profile", value: "spam" },
  { label: "Harassment", value: "harassment" },
  { label: "Other", value: "other" },
] as const;

type ReportType = "bug" | "ticket" | "content" | null;
type ContentSubType = "diary_comment" | "profile" | null;

function useCurrentUrl() {
  const searchParams = useSearchParams();
  return useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, [searchParams]);
}

export default function ReportPage() {
  const router = useRouter();
  const currentUrl = useCurrentUrl();
  const [reportType, setReportType] = useState<ReportType>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [bugDescription, setBugDescription] = useState("");
  const [bugPath, setBugPath] = useState("");
  const didInitPath = useRef(false);
  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin + "/";
  }, []);

  useEffect(() => {
    if (reportType === "bug" && !didInitPath.current && currentUrl && baseUrl) {
      setBugPath(currentUrl.replace(baseUrl, ""));
      didInitPath.current = true;
    }
    if (reportType !== "bug") {
      didInitPath.current = false;
    }
  }, [reportType, currentUrl, baseUrl]);

  const [ticketCategory, setTicketCategory] = useState<(typeof TICKET_CATEGORIES)[number]["value"]>("general_inquiry");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");

  const [contentSubType, setContentSubType] = useState<ContentSubType>(null);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileReason, setProfileReason] = useState<(typeof PROFILE_REASONS)[number]["value"]>("other");

  const handleSubmitBug = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (!bugDescription.trim()) {
        setError("Description is required");
        return;
      }
      setSubmitting(true);
      try {
        await apiClient.post("/reports", {
          reason: "bug",
          description: bugDescription.trim(),
          url: baseUrl + bugPath,
          user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "",
        });
        setSuccess(true);
        showToast("Bug report submitted");
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
          "Failed to submit bug report";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [bugDescription, currentUrl],
  );

  const handleSubmitTicket = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (!ticketSubject.trim()) {
        setError("Subject is required");
        return;
      }
      if (!ticketDescription.trim()) {
        setError("Description is required");
        return;
      }
      setSubmitting(true);
      try {
        await apiClient.post("/tickets", {
          category: ticketCategory,
          subject: ticketSubject.trim(),
          description: ticketDescription.trim(),
        });
        setSuccess(true);
        showToast("Ticket submitted");
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
          "Failed to submit ticket";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [ticketCategory, ticketSubject, ticketDescription],
  );

  const handleSubmitContentReport = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (contentSubType === "profile") {
        if (!profileUsername.trim()) {
          setError("Username is required");
          return;
        }
        setSubmitting(true);
        try {
          const userResponse = await apiClient.get(`/users/${profileUsername.trim()}`);
          const userId = userResponse.data?.data?.id;
          if (!userId) {
            setError("User not found");
            setSubmitting(false);
            return;
          }
          await apiClient.post("/reports", {
            target_type: "user",
            target_id: userId,
            reason: profileReason,
          });
          setSuccess(true);
          showToast("Content report submitted");
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
            "Failed to submit report";
          setError(msg);
        } finally {
          setSubmitting(false);
        }
      }
    },
    [contentSubType, profileUsername, profileReason],
  );

  const reset = () => {
    setReportType(null);
    setContentSubType(null);
    setError("");
    setSuccess(false);
    setBugDescription("");
    setBugPath("");
    didInitPath.current = false;
    setTicketCategory("general_inquiry");
    setTicketSubject("");
    setTicketDescription("");
    setProfileUsername("");
    setProfileReason("other");
  };

  if (success) {
    return (
      <ProtectedRoute>
        <div className="max-w-lg mx-auto py-12 px-4">
          <div className="border border-border p-6 text-center">
            <h1 className="font-serif text-xl mb-3">Submitted</h1>
            <p className="text-sm text-muted mb-4">Your submission has been received. We will review it shortly.</p>
            <Button variant="secondary" size="sm" onClick={reset}>
              Submit another
            </Button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-lg mx-auto py-8 px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0 mb-3"
        >
          &larr; Back
        </button>
        <h1 className="font-serif text-xl mb-2">Report</h1>
        <p className="text-sm text-muted mb-6">Let us know what&apos;s on your mind.</p>

        {!reportType && (
          <div className="space-y-3">
            {(
              [
                { key: "bug" as const, label: "Report a Bug", desc: "Found something broken? Tell us." },
                { key: "ticket" as const, label: "Open a Ticket", desc: "Need help or have a question?" },
                { key: "content" as const, label: "Report Content", desc: "Report a diary, comment, or profile." },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setReportType(opt.key)}
                className="w-full border border-border p-4 text-left cursor-pointer hover:bg-overlay transition-colors bg-transparent"
              >
                <div className="text-sm font-medium text-foreground">{opt.label}</div>
                <div className="text-xs text-muted mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        {reportType === "bug" && (
          <form onSubmit={handleSubmitBug} className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportType(null)}
                className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0"
              >
                &larr; Back
              </button>
              <h2 className="text-sm font-medium">Report a Bug</h2>
            </div>
            <div>
              <label className="text-xs text-muted">Page URL</label>
              <div className="flex items-center border border-border mt-1">
                <span className="text-xs text-subtle bg-overlay px-2 py-2 border-r border-border shrink-0">
                  {baseUrl}
                </span>
                <input
                  value={bugPath}
                  onChange={(e) => setBugPath(e.target.value)}
                  placeholder="report"
                  className="flex-1 bg-transparent px-2 py-2 text-xs text-foreground border-0 focus:outline-none"
                  disabled={submitting}
                />
              </div>
            </div>
            <div>
              <label htmlFor="bug-description" className="text-xs text-muted">
                Description
              </label>
              <textarea
                id="bug-description"
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                rows={5}
                maxLength={2000}
                className="w-full border border-border bg-background text-sm p-2 text-foreground resize-none mt-1"
                placeholder="Describe what happened..."
                disabled={submitting}
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" variant="primary" disabled={submitting} className="w-full">
              {submitting ? "Submitting..." : "Submit Bug Report"}
            </Button>
          </form>
        )}

        {reportType === "ticket" && (
          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportType(null)}
                className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0"
              >
                &larr; Back
              </button>
              <h2 className="text-sm font-medium">Open a Ticket</h2>
            </div>
            <div>
              <label htmlFor="ticket-category" className="text-xs text-muted">
                Category
              </label>
              <select
                id="ticket-category"
                value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value as (typeof TICKET_CATEGORIES)[number]["value"])}
                className="w-full border border-border bg-background text-sm p-2 text-foreground mt-1 cursor-pointer"
                disabled={submitting}
              >
                {TICKET_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ticket-subject" className="text-xs text-muted">
                Subject
              </label>
              <Input
                id="ticket-subject"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Brief subject"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="ticket-description" className="text-xs text-muted">
                Description
              </label>
              <textarea
                id="ticket-description"
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                rows={5}
                maxLength={3000}
                className="w-full border border-border bg-background text-sm p-2 text-foreground resize-none mt-1"
                placeholder="Describe your issue or question..."
                disabled={submitting}
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" variant="primary" disabled={submitting} className="w-full">
              {submitting ? "Submitting..." : "Submit Ticket"}
            </Button>
          </form>
        )}

        {reportType === "content" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportType(null)}
                className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0"
              >
                &larr; Back
              </button>
              <h2 className="text-sm font-medium">Report Content</h2>
            </div>

            {!contentSubType && (
              <div className="space-y-3">
                <button
                  onClick={() => setContentSubType("diary_comment")}
                  className="w-full border border-border p-4 text-left cursor-pointer hover:bg-overlay transition-colors bg-transparent"
                >
                  <div className="text-sm font-medium text-foreground">Diary / Comment</div>
                  <div className="text-xs text-muted mt-0.5">Report a diary entry or comment</div>
                </button>
                <button
                  onClick={() => setContentSubType("profile")}
                  className="w-full border border-border p-4 text-left cursor-pointer hover:bg-overlay transition-colors bg-transparent"
                >
                  <div className="text-sm font-medium text-foreground">Profile</div>
                  <div className="text-xs text-muted mt-0.5">Report a user profile</div>
                </button>
              </div>
            )}

            {contentSubType === "diary_comment" && (
              <div>
                <button
                  type="button"
                  onClick={() => setContentSubType(null)}
                  className="text-xs text-muted hover:text-foreground cursor-pointer bg-transparent border-0 mb-4"
                >
                  &larr; Back
                </button>
                <div className="border border-border p-4 bg-overlay text-center">
                  <p className="text-sm text-foreground mb-2">
                    To report a diary or comment, use the report button directly on the content page.
                  </p>
                  <p className="text-xs text-muted">
                    Navigate to the diary or comment you want to report and click the flag/report button there.
                  </p>
                </div>
              </div>
            )}

            {contentSubType === "profile" && (
              <form onSubmit={handleSubmitContentReport} className="space-y-4">
                <div>
                  <label htmlFor="profile-username" className="text-xs text-muted">
                    Username to report
                  </label>
                  <Input
                    id="profile-username"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    placeholder="e.g. johndoe"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="profile-reason" className="text-xs text-muted">
                    Reason
                  </label>
                  <select
                    id="profile-reason"
                    value={profileReason}
                    onChange={(e) => setProfileReason(e.target.value as (typeof PROFILE_REASONS)[number]["value"])}
                    className="w-full border border-border bg-background text-sm p-2 text-foreground mt-1 cursor-pointer"
                    disabled={submitting}
                  >
                   {PROFILE_REASONS.map((r) => (
                     <option key={r.value} value={r.value}>
                       {r.label}
                     </option>
                   ))}
                  </select>
                </div>
                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <Button type="submit" variant="primary" disabled={submitting} className="w-full">
                  {submitting ? "Submitting..." : "Submit Report"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
