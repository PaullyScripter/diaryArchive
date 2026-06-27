"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WARNING_LABELS: Record<string, string> = {
  adut: "Adult / Explicit content",
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
  const needsAgeGate = warnings.includes("adut");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="max-w-md mx-4 p-8 border border-border rounded-lg bg-background shadow-lg text-center">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
        <h2 className="font-serif text-lg font-semibold text-foreground mb-2">
          Content Warning
        </h2>
        <p className="text-sm text-muted mb-4">
          The author has flagged this diary as containing:
        </p>
        <ul className="text-sm text-foreground space-y-1.5 mb-6">
          {warnings.map((w) => (
            <li key={w} className="px-3 py-1.5 bg-[hsl(0,52%,53%,0.08)] dark:bg-[hsl(0,60%,65%,0.12)] border border-[hsl(0,52%,53%,0.2)] dark:border-[hsl(0,60%,65%,0.25)] rounded-md">
              {WARNING_LABELS[w] ?? w}
            </li>
          ))}
        </ul>

        {needsAgeGate && (
          <label className="flex items-center justify-center gap-2 mb-4 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="rounded border-border cursor-pointer"
            />
            I confirm I am 18 years or older
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
