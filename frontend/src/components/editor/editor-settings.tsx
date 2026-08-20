"use client";

import { Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { TagsAutocomplete } from "@/components/editor/tags-autocomplete";
import { EMOTION_SUGGESTIONS } from "@/components/shared/emotion-badge";

interface EditorSettingsProps {
  privacy: string;
  setPrivacy: (p: string) => void;
  tags: string[];
  setTags: (t: string[]) => void;
  emotion: string;
  setEmotion: (e: string) => void;
  commentsEnabled: boolean;
  setCommentsEnabled: (v: boolean) => void;
  contentWarnings: string[];
  toggleWarning: (w: string) => void;
  hasMasterKey: boolean;
  isEditMode: boolean;
  onSetupEncryption: () => void;
  isHtmlCss: boolean;
  fixedEnabled: boolean;
  fixedWidth: number;
  fixedHeight: number;
  setFixedEnabled: (v: boolean) => void;
  setFixedWidth: (v: number) => void;
  setFixedHeight: (v: number) => void;
}

export function EditorSettings({
  privacy,
  setPrivacy,
  tags,
  setTags,
  emotion,
  setEmotion,
  commentsEnabled,
  setCommentsEnabled,
  contentWarnings,
  toggleWarning,
  hasMasterKey,
  isEditMode,
  onSetupEncryption,
  isHtmlCss,
  fixedEnabled,
  fixedWidth,
  fixedHeight,
  setFixedEnabled,
  setFixedWidth,
  setFixedHeight,
}: EditorSettingsProps) {
  const warnings: Array<{ key: string; label: string }> = [
    { key: "adult", label: "Adult / Explicit" },
    { key: "violence", label: "Graphic Violence" },
    { key: "self-harm", label: "Self-Harm / Suicide" },
    { key: "substance", label: "Substance Use" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-medium text-foreground mb-2">Privacy</label>
        <div className="space-y-2">
          {[
            { value: "public", label: "Public - visible to everyone" },
            { value: "private", label: "Private - end-to-end encrypted, only you can read" },
            { value: "draft", label: "Draft - only visible to you" },
          ].map(({ value, label }) => {
            const isPrivate = value === "private";
            const disabled = isEditMode;
            const needsSetup = isPrivate && !hasMasterKey && !isEditMode;
            return (
              <label
                key={value}
                className={`flex items-center gap-2 text-sm cursor-pointer ${
                  disabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <input
                  type="radio"
                  name="editor-privacy"
                  checked={privacy === value}
                  onChange={() => {
                    if (needsSetup) {
                      onSetupEncryption();
                    } else {
                      setPrivacy(value);
                    }
                  }}
                  disabled={disabled}
                  className="rounded-full border-border cursor-pointer disabled:cursor-not-allowed"
                />
                {isPrivate && <Lock className="w-3 h-3 text-muted" />}
                <span className={isPrivate ? "text-foreground" : ""}>
                  {label}
                </span>
                {needsSetup && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onSetupEncryption();
                    }}
                    className="ml-auto text-xs text-link hover:underline cursor-pointer"
                  >
                    Set up encryption
                  </button>
                )}
              </label>
            );
          })}
        </div>
        {isEditMode && (
          <p className="text-xs text-muted mt-1">
            Privacy cannot be changed after creation.
          </p>
        )}
        {privacy === "private" && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 mt-2">
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              <strong>Read before writing privately.</strong> Your private diaries
              are encrypted end-to-end and can only be decrypted with a master key
              unlocked by your password. If you change your password in Settings
              without re-encrypting that key, these diaries are{" "}
              <strong>permanently destroyed</strong>. Keep a recovery email and your
              password safe. Losing your password without a recovery email also
              permanently destroys them.
            </p>
          </div>
        )}
      </div>

      {privacy !== "private" && (
        <>
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">Tags</label>
            <TagsAutocomplete value={tags} onChange={setTags} max={50} />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-2">Emotion</label>
            <Input
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              placeholder="how are you feeling?"
              maxLength={50}
              list="editor-emotion-suggestions"
            />
            <datalist id="editor-emotion-suggestions">
              {EMOTION_SUGGESTIONS.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-2">Comments</label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={commentsEnabled}
                onChange={(e) => setCommentsEnabled(e.target.checked)}
                className="rounded border-border cursor-pointer"
              />
              Allow comments on this diary
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              Content Warnings <span className="text-subtle font-normal">(optional)</span>
            </label>
            <div className="space-y-2">
              {warnings.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
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
        </>
      )}

      {privacy === "private" && (
        <>
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">Tags</label>
            <TagsAutocomplete value={tags} onChange={setTags} max={50} />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-2">Emotion</label>
            <Input
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              placeholder="how are you feeling?"
              maxLength={50}
              list="editor-emotion-suggestions"
            />
            <datalist id="editor-emotion-suggestions">
              {EMOTION_SUGGESTIONS.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </div>
        </>
      )}

      {isHtmlCss && (
        <div className="rounded-md border border-border bg-background p-4">
          <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={fixedEnabled}
              onChange={(e) => setFixedEnabled(e.target.checked)}
              className="mt-0.5 rounded border-border cursor-pointer"
            />
            <span>
              Fixed width and height
              <span className="block text-xs text-subtle font-normal mt-0.5">
                Lock this HTML/CSS diary to a fixed window size. The diary scrolls
                inside its own window instead of flooding the whole page, so
                readers reach the comments faster.
              </span>
            </span>
          </label>

          {fixedEnabled && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1" htmlFor="fixed-width">
                  Width (px)
                </label>
                <Input
                  id="fixed-width"
                  type="number"
                  min={320}
                  max={2000}
                  value={fixedWidth}
                  onChange={(e) => setFixedWidth(Math.max(320, Math.min(2000, Number(e.target.value) || 320)))}
                />
                <p className="mt-1 text-[11px] text-subtle">320 - 2000</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1" htmlFor="fixed-height">
                  Height (px)
                </label>
                <Input
                  id="fixed-height"
                  type="number"
                  min={240}
                  max={2000}
                  value={fixedHeight}
                  onChange={(e) => setFixedHeight(Math.max(240, Math.min(2000, Number(e.target.value) || 240)))}
                />
                <p className="mt-1 text-[11px] text-subtle">240 - 2000</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}