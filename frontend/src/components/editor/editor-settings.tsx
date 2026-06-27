"use client";

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
}: EditorSettingsProps) {
  const warnings: Array<{ key: string; label: string }> = [
    { key: "adut", label: "Adult / Explicit" },
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
            { value: "draft", label: "Draft — only visible to you" },
          ].map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="radio"
                name="editor-privacy"
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
    </div>
  );
}