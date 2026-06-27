"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMOTION_SUGGESTIONS } from "@/components/shared/emotion-badge";

interface DiaryFormProps {
  initialData?: {
    id?: string;
    title?: string;
    content_html?: string;
    content_text?: string;
    tags?: string[];
    emotion?: string | null;
    privacy?: string;
    comments_enabled?: boolean;
    content_warnings?: string[];
  };
  onSubmit: (data: Record<string, unknown>) => Promise<{ id: string } | void>;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export function DiaryForm({
  initialData,
  onSubmit,
  submitLabel = "Publish",
  isSubmitting,
}: DiaryFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [contentText, setContentText] = useState(initialData?.content_text ?? "");
  const [tagsInput, setTagsInput] = useState(initialData?.tags?.join(", ") ?? "");
  const [emotion, setEmotion] = useState(initialData?.emotion ?? "");
  const [privacy, setPrivacy] = useState(initialData?.privacy ?? "public");
  const [commentsEnabled, setCommentsEnabled] = useState(initialData?.comments_enabled ?? true);
  const [contentWarnings, setContentWarnings] = useState<string[]>(initialData?.content_warnings ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggleWarning = (w: string) => {
    setContentWarnings((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]
    );
  };

  const tags = tagsInput
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const handleSubmit = async (asDraft = false) => {
    setError(null);
    if (!asDraft && !title.trim()) {
      setError("Title is required for public diaries.");
      return;
    }
    try {
      const result = await onSubmit({
        privacy: asDraft ? "draft" : privacy,
        title: title.trim() || null,
        content_html: contentText
          ? `<p>${contentText.replace(/\n/g, "</p><p>")}</p>`
          : null,
        content_text: contentText || null,
        tags,
        emotion: emotion || null,
        comments_enabled: commentsEnabled,
        content_warnings: contentWarnings,
      });
      if (result && "id" in result) {
        router.push(`/diary/${result.id}`);
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? "Failed to save diary";
      setError(message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="space-y-6">
        <div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's on your mind?"
            className="font-serif text-xl font-semibold border-none bg-transparent px-0 placeholder:text-muted/50 focus:ring-0"
            maxLength={200}
          />
          <p className="text-xs text-muted mt-1">{title.length}/200</p>
        </div>

        <div>
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Write freely. This is your space. (Plain text for now — rich editor coming soon)"
            className="w-full min-h-[300px] border border-border rounded-md bg-background px-4 py-3 text-sm font-serif leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted/50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Tags</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="life, reflection, family"
            />
            <p className="text-xs text-subtle mt-1">
              Comma-separated, lowercase (max 10)
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Emotion</label>
            <Input
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              placeholder="how are you feeling?"
              maxLength={50}
              list="emotion-suggestions"
            />
            <datalist id="emotion-suggestions">
              {EMOTION_SUGGESTIONS.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              Privacy
            </label>
            <div className="space-y-2">
              {[
                { value: "public", label: "Public — visible to everyone" },
                { value: "draft", label: "Draft — only visible to you" },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
                >
                  <input
                    type="radio"
                    name="privacy"
                    checked={privacy === value}
                    onChange={() => setPrivacy(value)}
                    className="rounded-full border-border cursor-pointer"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              Comments
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={commentsEnabled}
                onChange={() => setCommentsEnabled(!commentsEnabled)}
                className="rounded border-border cursor-pointer"
              />
              Allow comments on this diary
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-2">
            Content Warnings <span className="text-subtle font-normal">(optional)</span>
          </label>
          <div className="space-y-2">
            {[
              { key: "adut", label: "Adult / Explicit" },
              { key: "violence", label: "Graphic Violence" },
              { key: "self-harm", label: "Self-Harm / Suicide" },
              { key: "substance", label: "Substance Use" },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={contentWarnings.includes(key)}
                  onChange={() => toggleWarning(key)}
                  className="rounded border-border cursor-pointer"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => router.back()} type="button">
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting ? "Publishing..." : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
