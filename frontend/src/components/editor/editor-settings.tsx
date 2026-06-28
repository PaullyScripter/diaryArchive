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
            { value: "public", label: "Public — visible to everyone" },
            { value: "private", label: "Private — end-to-end encrypted, only you can read" },
            { value: "draft", label: "Draft — only visible to you" },
          ].map(({ value, label }) => {
            const isPrivate = value === "private";
            const disabled = isEditMode || (isPrivate && !hasMasterKey);
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
                  onChange={() => setPrivacy(value)}
                  disabled={disabled}
                  className="rounded-full border-border cursor-pointer disabled:cursor-not-allowed"
                />
                {isPrivate && <Lock className="w-3 h-3 text-destructive" />}
                <span className={isPrivate ? "text-foreground" : ""}>
                  {label}
                </span>
              </label>
            );
          })}
        </div>
        {isEditMode && (
          <p className="text-xs text-muted mt-1">
            Privacy cannot be changed after creation.
          </p>
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
    </div>
  );
}