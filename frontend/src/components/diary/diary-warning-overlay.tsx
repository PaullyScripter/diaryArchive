"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WARNING_LABELS: Record<string, string> = {
  adult: "Adult / Explicit content",
  violence: "Graphic violence",
  "self-harm": "Self-harm or suicide",
  substance: "Substance use",
};

interface WarningOverlayProps {
  warnings: string[];
  onAcknowledge: () => void;
}

export function WarningOverlay({ warnings, onAcknowledge }: WarningOverlayProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const needsAgeGate = warnings.includes("adult");
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // P3.5: Focus trap. Move focus into the overlay on mount, trap Tab cycles,
  // and restore the previously focused element on unmount.
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = container.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onAcknowledge();
        return;
      }
      if (e.key !== "Tab") return;

      if (!container) return;
      const allFocusable = container.querySelectorAll<HTMLElement>(focusableSelector);
      if (allFocusable.length === 0) return;

      const first = allFocusable[0];
      const last = allFocusable[allFocusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onAcknowledge]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby="content-warning-title"
    >
      <div className="max-w-sm mx-4 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-foreground mx-auto mb-4" />
        <h2 id="content-warning-title" className="font-serif text-lg font-semibold text-foreground mb-2">
          Content Warning
        </h2>
        <p className="text-sm text-muted mb-4">
          This diary has been flagged as containing:
        </p>
        <div className="space-y-1 mb-6">
          {warnings.map((w) => (
            <p key={w} className="text-sm text-foreground">
              {WARNING_LABELS[w] ?? w}
            </p>
          ))}
        </div>

        {needsAgeGate && (
          <label className="flex items-center justify-center gap-2 mb-4 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="rounded border-border cursor-pointer"
            />
            I confirm I am 18 or older
          </label>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={onAcknowledge}
          disabled={needsAgeGate && !ageConfirmed}
        >
          I understand, show me the diary
        </Button>
      </div>
    </div>
  );
}
