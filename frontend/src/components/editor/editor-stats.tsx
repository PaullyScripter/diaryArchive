"use client";

import { useEffect, useState } from "react";

interface EditorStatsProps {
  words: number;
  characters: number;
  saveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
}

export function EditorStats({ words, characters, saveStatus, lastSavedAt }: EditorStatsProps) {
  const [timeAgo, setTimeAgo] = useState("");

  useEffect(() => {
    if (!lastSavedAt) {
      setTimeAgo("");
      return;
    }
    const update = () => {
      const diff = Date.now() - lastSavedAt.getTime();
      const seconds = Math.floor(diff / 1000);
      if (seconds < 5) setTimeAgo("just now");
      else if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  const statusText = {
    idle: "",
    saving: "Saving...",
    saved: timeAgo ? `Saved ${timeAgo}` : "Saved",
    error: "Save failed",
  }[saveStatus];

  return (
    <div className="flex items-center justify-between border border-border rounded-md bg-background px-3 py-1.5 mt-2">
      <div className="flex items-center gap-4 text-xs text-subtle">
        <span>{words} words</span>
        <span>·</span>
        <span>{characters} chars</span>
      </div>
      <div
        className={`text-xs ${
          saveStatus === "error"
            ? "text-destructive"
            : saveStatus === "saved"
              ? "text-muted"
              : "text-subtle"
        }`}
        aria-live="polite"
      >
        {statusText}
      </div>
    </div>
  );
}