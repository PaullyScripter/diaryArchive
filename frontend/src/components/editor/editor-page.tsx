"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { useCreateDiary, useUpdateDiary, useDeleteDiary } from "@/hooks/use-diaries";
import { useDiary } from "@/hooks/use-diaries";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorSettings } from "@/components/editor/editor-settings";
import { EditorStats } from "@/components/editor/editor-stats";
import { useAuthStore } from "@/store/auth-store";

import { useDraft } from "@/hooks/use-draft";

const TiptapEditor = dynamic(
  () => import("@/components/editor/tiptap-editor").then((m) => m.TiptapEditor),
  { ssr: false, loading: () => <div className="min-h-[300px] border border-border rounded-md bg-overlay/5 animate-pulse" /> },
);
const EditorToolbar = dynamic(
  () => import("@/components/editor/editor-toolbar").then((m) => m.EditorToolbar),
  { ssr: false },
);
const FloatingToolbar = dynamic(
  () => import("@/components/editor/floating-toolbar").then((m) => m.FloatingToolbar),
  { ssr: false },
);

interface EditorPageProps {
  diaryId?: string;
}

function EditorPageContent({ diaryId }: EditorPageProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const createDiary = useCreateDiary();
  const updateDiary = useUpdateDiary();
  const deleteDiary = useDeleteDiary();

  const { data: existingDiary, isLoading: isLoadingDiary } = useDiary(diaryId ?? "");
  const isEditMode = !!diaryId;

  const [editor, setEditor] = useState<Editor | null>(null);
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [contentText, setContentText] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [sourceMode, setSourceMode] = useState(false);
  const [customCss, setCustomCss] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [emotion, setEmotion] = useState("");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [contentWarnings, setContentWarnings] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const { draft, hasRecoveredDraft, discard: discardDraft, clear: clearDraft } = useDraft();

  useEffect(() => {
    if (isEditMode && existingDiary) {
      setTitle(existingDiary.title ?? "");
      setContentHtml(existingDiary.content_html ?? "");
      setContentText(existingDiary.content_text ?? "");
      setPrivacy(existingDiary.privacy);
      setTags(existingDiary.tags ?? []);
      setEmotion(existingDiary.emotion ?? "");
      setCommentsEnabled(existingDiary.comments_enabled);
      setContentWarnings(existingDiary.content_warnings ?? []);
    } else if (!isEditMode && !hasRecoveredDraft) {
      // new diary, no recovered draft
      setCommentsEnabled(true);
    }
  }, [isEditMode, existingDiary, hasRecoveredDraft]);

  useEffect(() => {
    if (!isEditMode && draft && hasRecoveredDraft) {
      setTitle(draft.title);
      setContentHtml(draft.contentHtml);
      setContentText(draft.contentText || "");
      setPrivacy(draft.privacy);
      setTags(draft.tags);
      setEmotion(draft.emotion);
      setCommentsEnabled(draft.commentsEnabled);
      setContentWarnings(draft.contentWarnings ?? []);
    }
  }, [draft, hasRecoveredDraft, isEditMode]);

  useEffect(() => {
    setIsDirty(true);
  }, [title, contentHtml, tags, emotion, privacy, commentsEnabled, contentWarnings]);

  const toggleWarning = (w: string) => {
    setContentWarnings((prev) => prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]);
  };

  const onContentChange = useCallback((html: string, text: string) => {
    setContentHtml(html);
    setContentText(text);
    setIsDirty(true);
  }, []);

  const words = contentText.trim() ? contentText.trim().split(/\s+/).length : 0;
  const characters = contentText.length;

  const doSave = async (publishPrivacy?: string) => {
    const finalPrivacy = publishPrivacy ?? privacy;
    setSaveStatus("saving");
    try {
      const payload = {
        privacy: finalPrivacy,
        title: title.trim() || null,
        content_html: customCss ? `<style>${customCss}</style>${contentHtml}` : contentHtml,
        content_text: contentText,
        tags,
        emotion: emotion || null,
        comments_enabled: commentsEnabled,
        content_warnings: contentWarnings,
      };
      if (isEditMode && diaryId) {
        await updateDiary.mutateAsync({ id: diaryId, ...payload });
      } else {
        const result = await createDiary.mutateAsync(payload);
        if (result && result.id) {
          if (finalPrivacy !== "draft") {
            clearDraft();
            router.push(`/diary/${result.id}`);
            return;
          }
        }
      }
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      if (finalPrivacy === "public" && isEditMode && diaryId) {
        router.push(`/diary/${diaryId}`);
      }
    } catch {
      setSaveStatus("error");
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && (title.trim() || contentText.trim())) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, title, contentText]);

  useEffect(() => {
    if (!isEditMode) {
      draft as any;
      void draft;
    }
  }, [title, contentHtml, contentText, tags, emotion, privacy, commentsEnabled, contentWarnings, isEditMode, draft]);

  const handleDelete = async () => {
    if (!diaryId) return;
    if (!confirm("Delete this diary permanently?")) return;
    await deleteDiary.mutateAsync(diaryId);
    router.push("/me");
  };

  if (isEditMode && isLoadingDiary) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-4">
        <div className="min-h-[400px] border border-border rounded-md bg-overlay/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-4">
        <Link
          href={isEditMode ? `/diary/${diaryId}` : "/"}
          className="text-xs text-muted hover:text-foreground no-underline hover:underline"
        >
          &larr; Back
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => doSave("draft")}
          >
            Save Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => doSave("public")}
          >
            {isEditMode ? "Save Changes" : "Publish"}
          </Button>
        </div>
      </div>

      {!isEditMode && hasRecoveredDraft && draft && (
        <div className="mb-4 p-3 border border-border rounded-md bg-overlay/5 flex items-center justify-between">
          <p className="text-xs text-muted">
            Draft recovered from {new Date(draft.updatedAt).toLocaleTimeString()}
          </p>
          <button
            onClick={discardDraft}
            className="text-xs text-destructive hover:underline cursor-pointer"
          >
            Discard
          </button>
        </div>
      )}

      <div className="mb-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's on your mind?"
          className="font-serif text-xl font-semibold border-none bg-transparent px-0 placeholder:text-muted/50 focus:ring-0"
          maxLength={200}
        />
      </div>

      <EditorToolbar editor={editor} sourceMode={sourceMode} onToggleSource={() => setSourceMode(!sourceMode)} />

      <div className="relative">
        <FloatingToolbar editor={editor} />
        {sourceMode ? (
          <textarea
            value={contentHtml}
            onChange={(e) => {
              setContentHtml(e.target.value);
              setContentText(e.target.value.replace(/<[^>]*>/g, ""));
              setIsDirty(true);
            }}
            className="w-full min-h-[300px] font-mono text-sm border border-border rounded-md bg-background text-foreground px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder="Write HTML directly..."
          />
        ) : (
          <TiptapEditor
            content={contentHtml}
            onChange={onContentChange}
            onEditorReady={setEditor}
          />
        )}
      </div>

      <EditorStats
        words={words}
        characters={characters}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Diary Settings</h3>
          <EditorSettings
            privacy={privacy}
            setPrivacy={setPrivacy}
            tags={tags}
            setTags={setTags}
            emotion={emotion}
            setEmotion={setEmotion}
            commentsEnabled={commentsEnabled}
            setCommentsEnabled={setCommentsEnabled}
            contentWarnings={contentWarnings}
            toggleWarning={toggleWarning}
          />

          <div className="mt-6">
            <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
              Custom CSS <span className="text-subtle font-normal">(advanced)</span>
            </h3>
            <textarea
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder="/* Style your diary with custom CSS. Will be wrapped in a style tag. */"
              className="w-full min-h-[100px] font-mono text-xs border border-border rounded-md bg-background text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
            <p className="text-xs text-subtle mt-1">
              CSS is included in your diary content. Use responsibly.
            </p>
          </div>
        </div>

        {isEditMode && (
          <div>
            <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Actions</h3>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteDiary.isPending}
            >
              {deleteDiary.isPending ? "Deleting..." : "Delete Diary"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditorPage({ diaryId }: EditorPageProps) {
  return (
    <ProtectedRoute>
      <EditorPageContent diaryId={diaryId} />
    </ProtectedRoute>
  );
}