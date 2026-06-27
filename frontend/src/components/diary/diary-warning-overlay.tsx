"use client";

import { useState } from "react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/50 font-[system-ui]">
      <div className="max-w-[400px] mx-4 border-2 border-[#808080] shadow-[1px_1px_0_#fff_inset,-1px_-1px_0_#808080_inset,2px_2px_0_#000] bg-[#c0c0c0]">
        <div className="bg-[#000080] text-white px-2 py-1 flex items-center justify-between">
          <span className="text-[13px] font-bold">Content Warning</span>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5 select-none">⚠️</span>
            <div>
              <p className="text-[13px] text-[#000] mb-2">
                The author has flagged this diary as containing:
              </p>
              <div className="space-y-1">
                {warnings.map((w) => (
                  <div
                    key={w}
                    className="px-2 py-1 text-[13px] text-[#000] border border-[#808080] bg-white shadow-[inset_1px_1px_0_#808080,inset_-1px_-1px_0_#fff]"
                  >
                    {WARNING_LABELS[w] ?? w}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {needsAgeGate && (
            <label className="flex items-center gap-2 text-[13px] text-[#000] cursor-pointer">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="w-3.5 h-3.5 border-2 border-[#808080] bg-white appearance-none checked:appearance-auto accent-[#000080] cursor-pointer"
              />
              I confirm I am 18 years or older
            </label>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onAcknowledge}
              disabled={needsAgeGate && !ageConfirmed}
              className="px-6 py-1.5 text-[13px] font-[system-ui] bg-[#c0c0c0] text-[#000] border-2 border-[#808080] shadow-[1px_1px_0_#fff_inset,-1px_-1px_0_#808080_inset,2px_2px_0_#000] active:shadow-[inset_1px_1px_0_#808080,inset_-1px_-1px_0_#fff] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
