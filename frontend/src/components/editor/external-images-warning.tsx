"use client";

import { X } from "lucide-react";

interface ExternalImagesWarningProps {
  count: number;
  isPrivate: boolean;
  onDismiss: () => void;
  className?: string;
}

export function ExternalImagesWarning({
  count,
  isPrivate,
  onDismiss,
  className = "",
}: ExternalImagesWarningProps) {
  if (count <= 0) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-foreground ${className}`}
    >
      <p className="text-muted mt-0.5 flex-1">
        <span className="font-medium text-accent">
          External image{count > 1 ? "s" : ""} removed for privacy.
        </span>{" "}
        {isPrivate
          ? "Private diaries block all external images so your readers' data never leaks to third-party hosts. "
          : "Only secure https: images are allowed. "}
        Upload your image to the media library, then use the gallery or
        drop/paste it here to insert its own link.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 flex items-center gap-1 rounded px-1.5 py-1 text-accent font-medium cursor-pointer hover:bg-overlay"
        aria-label="Dismiss warning"
      >
        I understand.
      </button>
    </div>
  );
}