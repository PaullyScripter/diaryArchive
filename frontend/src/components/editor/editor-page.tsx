"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Eye, Lock, Shield, Maximize2, Minimize2 } from "lucide-react";
import { ExternalImagesWarning } from "@/components/editor/external-images-warning";

import { useCreateDiary, useUpdateDiary, useDeleteDiary } from "@/hooks/use-diaries";
import { useDiary } from "@/hooks/use-diaries";
import { useMasterKey } from "@/hooks/use-master-key";
import { useMediaUpload, type MediaItem } from "@/hooks/use-media";
import { showToast } from "@/components/shared/toast";
import { validateImageFile } from "@/lib/media-validator";
import { sanitizeHtml, sanitizeCss, findDisallowedImageSources } from "@/lib/sanitize";
import { IsolatedDiary } from "@/components/diary/isolated-diary";
import { ResizableDiaryWindow } from "@/components/diary/resizable-diary-window";
import { splitHtmlCss } from "@/lib/html-css";
import { PROSE_CLASSES } from "@/lib/prose";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { previewThemeStyle } from "@/lib/preview-theme";
import { resolveMediaUrl, resolveMediaUrlsInHtml } from "@/lib/media-url";
import { CodeEditor } from "@/components/editor/code-editor";
import { useTheme } from "@/components/providers/theme-provider";
import { encryptDiary } from "@/lib/crypto";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorSettings } from "@/components/editor/editor-settings";
import { EditorStats } from "@/components/editor/editor-stats";
import { MediaGalleryModal } from "@/components/media/media-gallery-modal";
import { useAuthStore } from "@/store/auth-store";

import { useDraft } from "@/hooks/use-draft";
import { ChapterManager } from "@/components/editor/chapter-manager";
import { TemplatePicker } from "@/components/editor/template-picker";
import type { DiaryTemplate } from "@/lib/editor/templates";

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
  const { resolvedTheme } = useTheme();
  const editorDark = resolvedTheme === "dark";
  const createDiary = useCreateDiary();
  const updateDiary = useUpdateDiary();
  const deleteDiary = useDeleteDiary();
  const uploadMedia = useMediaUpload();

  const { data: existingDiary, isLoading: isLoadingDiary } = useDiary(diaryId ?? "");
  const isEditMode = !!diaryId;

  const {
    masterKey,
    isAvailable: isMasterKeyAvailable,
    setupMasterKey,
    isLoading: isKeyLoading,
  } = useMasterKey();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [contentText, setContentText] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [sourceMode, setSourceMode] = useState(false);
  const [customCss, setCustomCss] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [emotion, setEmotion] = useState("");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [contentWarnings, setContentWarnings] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [setupInput, setSetupInput] = useState("");
  const [setupError, setSetupError] = useState("");
  const [keySetupStep, setKeySetupStep] = useState<"explain" | "password">("explain");
  const [previewWidth, setPreviewWidth] = useState<"mobile" | "tablet" | "full" | "custom">("full");
  const [customPreviewW, setCustomPreviewW] = useState(390);
  const [customPreviewH, setCustomPreviewH] = useState(600);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewTheme, setPreviewTheme] = useState<"system" | "light" | "dark">("system");
  const [previewNaturalWidth, setPreviewNaturalWidth] = useState<number | null>(null);
  const handlePreviewContentWidth = useCallback((w: number) => setPreviewNaturalWidth(w), []);
  const [livePreviewHtml, setLivePreviewHtml] = useState("");
  const [blockedExternalImages, setBlockedExternalImages] = useState<string[]>([]);
  const [imagesWarningDismissed, setImagesWarningDismissed] = useState(false);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const sourceEditorInsertRef = useRef<((text: string) => void) | null>(null);
  const [codeSplit, setCodeSplit] = useState(55);
  const [cssSplit, setCssSplit] = useState(65);

  // Resizable panes for the fullscreen source editor: a vertical divider
  // between the code panes and the live preview, and a horizontal divider
  // between the HTML and CSS editors.
  const startVerticalDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const container = e.currentTarget.parentElement as HTMLElement;
    const rect = container.getBoundingClientRect();
    const startPct = codeSplit;
    const onMove = (ev: PointerEvent) => {
      const delta = ((ev.clientX - startX) / rect.width) * 100;
      setCodeSplit(Math.min(85, Math.max(15, startPct + delta)));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [codeSplit]);

  const startHorizontalDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const container = e.currentTarget.parentElement as HTMLElement;
    const rect = container.getBoundingClientRect();
    const startPct = cssSplit;
    const onMove = (ev: PointerEvent) => {
      const delta = ((ev.clientY - startY) / rect.height) * 100;
      // Dragging up (negative delta) grows the CSS pane, so subtract.
      setCssSplit(Math.min(90, Math.max(25, startPct - delta)));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [cssSplit]);

  // A diary is "HTML/CSS" when it ships its own <style> block (either via the
  // separate Custom CSS box or inline in the HTML source. Such diaries must be
  // rendered isolated (Shadow DOM) and get wider preview surfaces.
  const isHtmlCss = customCss.trim() !== "" || /<style[\s>]/i.test(contentHtml);

  const handleImageUpload = useCallback(
    async (file: File, editorInstance: Editor) => {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        showToast(validation.error || "Invalid file");
        return;
      }
      try {
        const result = await uploadMedia.mutateAsync({
          file,
          isPrivate: privacy === "private",
        });
        editorInstance
          .chain()
          .focus()
          .setResizableImage({ src: resolveMediaUrl(result.url) ?? result.url })
          .run();
      } catch {
        // toast already shown by hook
      }
    },
    [uploadMedia, privacy],
  );

  const handleSourceImageFiles = useCallback(
    async (files: File[], insertAt: (text: string) => void) => {
      for (const file of files) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          showToast(validation.error || "Invalid file");
          continue;
        }
        try {
          const result = await uploadMedia.mutateAsync({
            file,
            isPrivate: privacy === "private",
          });
          // Insert a full <img> tag pointing at the uploaded media's own
          // relative /api/v1/media/<id> URL (resolved to the full origin at
          // render time), at the user's cursor.
          insertAt(
            `<img src="${resolveMediaUrl(result.url) ?? result.url}" alt="">`
          );
        } catch {
          // toast already shown by hook
        }
      }
    },
    [uploadMedia, privacy],
  );

  const handleSourceGalleryInsert = useCallback(
    (item: MediaItem) => {
      // In source mode, insert into the Monaco HTML/CSS editor at the cursor;
      // otherwise fall back to the Tiptap editor's default image insertion.
      const insertAt = sourceEditorInsertRef.current;
      const src = resolveMediaUrl(item.url) ?? item.url;
      if (sourceMode && insertAt) {
        insertAt(`<img src="${src}" alt="">`);
      } else if (editor) {
        editor.chain().focus().setResizableImage({ src }).run();
      }
    },
    [sourceMode, editor],
  );

  const { draft, hasRecoveredDraft, discard: discardDraft, clear: clearDraft } = useDraft();

  useEffect(() => {
    if (isEditMode && existingDiary) {
      const { css, html: bodyHtml } = splitHtmlCss(existingDiary.content_html ?? "");
      setTitle(existingDiary.title ?? "");
      setCustomCss(css);
      setContentHtml(bodyHtml);
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
      const { css, html: bodyHtml } = splitHtmlCss(draft.contentHtml);
      setTitle(draft.title);
      setCustomCss(css);
      setContentHtml(bodyHtml);
      setContentText(draft.contentText || "");
      setPrivacy(draft.privacy);
      setTags(draft.tags);
      setEmotion(draft.emotion);
      setCommentsEnabled(draft.commentsEnabled);
      setContentWarnings(draft.contentWarnings ?? []);
    }
  }, [draft, hasRecoveredDraft, isEditMode]);

  const applyTemplate = async (template: DiaryTemplate) => {
    if (
      contentHtml.trim() &&
      !(await confirmDialog({
        title: "Replace current content?",
        description: `This will replace your current content with the "${template.name}" template.`,
        confirmLabel: "Replace",
        variant: "destructive",
      }))
    ) {
      return;
    }
    setTitle(template.title);
    const { css, html: bodyHtml } = splitHtmlCss(template.contentHtml);
    setCustomCss(css);
    setContentHtml(bodyHtml);
    setContentText(template.contentHtml.replace(/<[^>]*>/g, ""));
    setTags(template.tags);
    if (template.emotion) setEmotion(template.emotion);
    setSourceMode(false);
    setShowTemplatePicker(false);
    showToast(`Applied "${template.name}" template`);
  };

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

  const handleSourceChange = (value: string) => {
    setContentHtml(value);
    setContentText(value.replace(/<[^>]*>/g, ""));
    setIsDirty(true);
  };

  // Debounce the live preview so sanitize doesn't re-run on every keystroke.
  // External https: images are allowed only for non-private (public/draft)
  // diaries; private diaries strip every external image (privacy: a reader's
  // IP/referrer must never leak to a third-party image host from a diary the
  // author marked private).
  const allowExternalImages = privacy !== "private";
  useEffect(() => {
    const raw = customCss
      ? `<style>${sanitizeCss(customCss)}</style>${contentHtml}`
      : contentHtml;
    const t = window.setTimeout(() => {
      const resolved = resolveMediaUrlsInHtml(raw);
      setLivePreviewHtml(sanitizeHtml(resolved, { allowExternalImages }));
      setBlockedExternalImages(findDisallowedImageSources(resolved, { allowExternalImages }));
    }, 160);
    return () => window.clearTimeout(t);
  }, [contentHtml, customCss, allowExternalImages]);

  const renderSourceEditor = (fullscreen: boolean) => (
    <div
      className={
        fullscreen
          ? "w-full h-full"
          : "w-full h-[360px] border border-border rounded-md bg-background"
      }
    >
      <CodeEditor
        language="html"
        value={contentHtml}
        onChange={handleSourceChange}
        height={fullscreen ? "100%" : 360}
        dark={editorDark}
        ariaLabel="HTML source editor"
        onImageFiles={handleSourceImageFiles}
        onApiReady={(api) => {
          sourceEditorInsertRef.current = api.insertAt;
        }}
      />
    </div>
  );

  const renderRichEditor = () => (
    <TiptapEditor
      content={contentHtml}
      onChange={onContentChange}
      onEditorReady={setEditor}
      onImageDrop={(file, editor) => handleImageUpload(file, editor)}
      onImagePaste={(file, editor) => handleImageUpload(file, editor)}
      onToggleAdvanced={() => setSourceMode(true)}
    />
  );

  const words = contentText.trim() ? contentText.trim().split(/\s+/).length : 0;
  const characters = contentText.length;

  const doSave = async (publishPrivacy?: string) => {
    const finalPrivacy = publishPrivacy ?? privacy;
    setSaveStatus("saving");
    // Strip external images when saving anything private (and never for the
    // encrypted payload — the browser is the only sanitizer for E2E data).
    // Non-private diaries may keep https: external images.
    const finalAllowExternalImages = finalPrivacy !== "private";
    const sanitizedContent = sanitizeHtml(
      customCss
        ? `<style>${sanitizeCss(customCss)}</style>${contentHtml}`
        : contentHtml,
      { allowExternalImages: finalAllowExternalImages }
    );
    try {
      let payload: Record<string, unknown>;
      if (finalPrivacy === "private") {
        if (!masterKey) {
          setShowKeySetup(true);
          setSaveStatus("error");
          return;
        }
        const encryptedPayload = await encryptDiary(
          {
            title: title.trim() || "Untitled",
            contentHtml: sanitizedContent,
            tags,
          },
          masterKey
        );
        payload = {
          privacy: "private",
          encrypted_data: encryptedPayload,
          tags,
          emotion: emotion || null,
        };
      } else {
        payload = {
          privacy: finalPrivacy,
          title: title.trim() || null,
          content_html: sanitizedContent,
          content_text: contentText,
          tags,
          emotion: emotion || null,
          comments_enabled: commentsEnabled,
          content_warnings: contentWarnings,
        };
      }
      if (isEditMode && diaryId) {
        await updateDiary.mutateAsync({ id: diaryId, ...payload } as Parameters<typeof updateDiary.mutateAsync>[0]);
      } else {
        const result = await createDiary.mutateAsync(
          payload as Parameters<typeof createDiary.mutateAsync>[0]
        );
        if (result && (result as { id?: string }).id) {
          if (finalPrivacy !== "draft") {
            clearDraft();
            router.push(`/diary/${(result as { id: string }).id}`);
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
    saveRef.current = doSave;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isExpanded]);

  const dirtyRef = useRef(isDirty);
  const titleRef = useRef(title);
  const contentTextRef = useRef(contentText);
  dirtyRef.current = isDirty;
  titleRef.current = title;
  contentTextRef.current = contentText;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current && (titleRef.current.trim() || contentTextRef.current.trim())) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleDelete = async () => {
    if (!diaryId) return;
    const ok = await confirmDialog({
      title: "Delete this diary permanently?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteDiary.mutateAsync({ id: diaryId });
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
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(true)}
            title="Preview before publishing"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => doSave("draft")}
          >
            Save Draft
          </Button>
          {privacy === "private" ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => doSave("private")}
            >
              <Lock className="w-3.5 h-3.5" />
              {isEditMode ? "Save Changes" : "Save Encrypted"}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => doSave("public")}
            >
              {isEditMode ? "Save Changes" : "Publish"}
            </Button>
          )}
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

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-subtle">
          Writing in whole-diary mode - start a chapter with an H1 heading.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/policy/advanced-editor"
            className="text-xs text-link hover:underline cursor-pointer"
          >
            About the Advanced Editor
          </Link>
          <button
            type="button"
            onClick={() => setShowTemplatePicker(true)}
            className="text-xs text-link hover:underline cursor-pointer"
          >
            Need an idea?
          </button>
        </div>
      </div>

      <EditorToolbar
        editor={editor}
        sourceMode={sourceMode}
        onToggleSource={() => setSourceMode(!sourceMode)}
        onImageUpload={(file) => {
          if (sourceMode) handleSourceImageFiles([file], (text) => sourceEditorInsertRef.current?.(text));
          else if (editor) handleImageUpload(file, editor);
        }}
        onOpenGallery={() => setShowGallery(true)}
        onOpenTemplates={() => setShowTemplatePicker(true)}
      />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              title="Expand editor to fill your screen"
              aria-label="Expand editor to full screen"
              className="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-xs text-muted hover:text-foreground bg-background/90 border border-border rounded-md px-2.5 py-1.5 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Expand
            </button>
            <FloatingToolbar editor={editor} />
            {sourceMode ? renderSourceEditor(false) : renderRichEditor()}
            {!imagesWarningDismissed && (
              <ExternalImagesWarning
                count={blockedExternalImages.length}
                isPrivate={privacy === "private"}
                onDismiss={() => setImagesWarningDismissed(true)}
                className="mt-2"
              />
            )}
          </div>
        </div>
        {!sourceMode && <ChapterManager editor={editor} />}
      </div>

      {isExpanded && (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen editor"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              {sourceMode ? "HTML Source" : "Writing"} - Fullscreen
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSourceMode(!sourceMode)}
                className="text-xs text-link hover:underline cursor-pointer"
              >
                {sourceMode ? "Switch to Visual" : "Switch to HTML"}
              </button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsExpanded(false)}
              >
                <Minimize2 className="w-3.5 h-3.5 mr-1" />
                Exit Fullscreen
              </Button>
            </div>
          </div>
          <div className="shrink-0 border-b border-border">
            <EditorToolbar
              editor={editor}
              sourceMode={sourceMode}
              onToggleSource={() => setSourceMode(!sourceMode)}
              onImageUpload={(file) => {
                if (sourceMode) handleSourceImageFiles([file], (text) => sourceEditorInsertRef.current?.(text));
                else if (editor) handleImageUpload(file, editor);
              }}
              onOpenGallery={() => setShowGallery(true)}
              onOpenTemplates={() => setShowTemplatePicker(true)}
            />
          </div>
          <div className={`flex-1 min-h-0 flex p-4 ${sourceMode ? "flex-row gap-0" : "flex-col gap-4"}`}>
            <div className="flex flex-col gap-4 min-h-0 min-w-0" style={sourceMode ? { width: `${codeSplit}%` } : { flex: 1 }}>
              <div className="relative flex-1 min-h-0 overflow-auto rounded-md border border-border">
                <FloatingToolbar editor={editor} />
                {sourceMode ? renderSourceEditor(true) : renderRichEditor()}
              </div>
              {!imagesWarningDismissed && (
                <ExternalImagesWarning
                  count={blockedExternalImages.length}
                  isPrivate={privacy === "private"}
                  onDismiss={() => setImagesWarningDismissed(true)}
                  className="mt-1"
                />
              )}
              {sourceMode && (
                <div
                  className="shrink-0 flex flex-col border border-border rounded-md overflow-hidden"
                  style={{ height: `${cssSplit}%`, minHeight: 160 }}
                >
                  <div
                    className="group relative flex items-center justify-between px-3 py-2 border-b border-border shrink-0 cursor-row-resize"
                    onPointerDown={startHorizontalDrag}
                    title="Drag to resize the HTML/CSS editors"
                  >
                    <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
                      Custom CSS{" "}
                      <span className="text-subtle font-normal">(advanced)</span>
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-subtle">
                      <div className="h-1 w-5 rounded-full bg-border" />
                      drag to resize
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <CodeEditor
                      language="css"
                      value={customCss}
                      onChange={setCustomCss}
                      height="100%"
                      dark={editorDark}
                      ariaLabel="Custom CSS editor"
                    />
                  </div>
                </div>
              )}
            </div>
            {sourceMode && (
              <div
                className="group relative self-stretch w-1.5 shrink-0 cursor-col-resize rounded hover:bg-accent/30 active:bg-accent/40"
                onPointerDown={startVerticalDrag}
                title="Drag to resize the code editor and live preview"
                role="separator"
                aria-orientation="vertical"
              />
            )}
            {sourceMode && (
              <div className="flex flex-col min-w-[320px] shrink-0 border border-border rounded-md overflow-hidden bg-background" style={{ width: `calc(100% - ${codeSplit}% - 1.5rem)` }}>
                <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
                    Live Preview
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 text-[10px]">
                      {(["mobile", "tablet", "full"] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setPreviewWidth(w)}
                          title={`Preview at ${w === "mobile" ? "mobile" : w === "tablet" ? "tablet" : "full"} width`}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${previewWidth === w ? "bg-tag-bg text-foreground" : "text-muted hover:text-foreground"}`}
                        >
                          {w === "mobile" ? "Mobile" : w === "tablet" ? "Tablet" : "Full"}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted" title="Custom preview size in pixels">
                      <input
                        type="number"
                        min={120}
                        max={2000}
                        value={customPreviewW}
                        onChange={(e) => {
                          setCustomPreviewW(Number(e.target.value) || 0);
                          setPreviewWidth("custom");
                        }}
                        className="w-14 rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                        aria-label="Custom preview width in pixels"
                      />
                      <span>&times;</span>
                      <input
                        type="number"
                        min={120}
                        max={2000}
                        value={customPreviewH}
                        onChange={(e) => {
                          setCustomPreviewH(Number(e.target.value) || 0);
                          setPreviewWidth("custom");
                        }}
                        className="w-14 rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                        aria-label="Custom preview height in pixels"
                      />
                    </div>
                    <span className="text-[10px] text-subtle">updates as you type</span>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <div
                    style={previewThemeStyle(previewTheme)}
                    className={`min-h-full p-2 bg-background ${previewTheme === "dark" ? "preview-dark" : previewTheme === "light" ? "preview-light" : ""}`}
                  >
                    <div
                      style={{
                        width: previewWidth === "mobile" ? 390 : previewWidth === "tablet" ? 768 : previewWidth === "custom" ? customPreviewW : "100%",
                        minHeight: previewWidth === "custom" ? customPreviewH : undefined,
                      }}
                      className={`mx-auto ${previewWidth === "custom" ? "overflow-y-auto" : ""}`}
                    >
                      {isHtmlCss ? (
                        <IsolatedDiary html={livePreviewHtml} />
                      ) : (
                        <article
                          className={PROSE_CLASSES}
                          dangerouslySetInnerHTML={{ __html: livePreviewHtml }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
            hasMasterKey={isMasterKeyAvailable}
            isEditMode={isEditMode}
            onSetupEncryption={() => setShowKeySetup(true)}
          />

          <div className="mt-6">
            <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
              Custom CSS <span className="text-subtle font-normal">(advanced)</span>
            </h3>
            <div className="w-full overflow-hidden rounded-md border border-border bg-background">
              <CodeEditor
                language="css"
                value={customCss}
                onChange={setCustomCss}
                height={140}
                dark={editorDark}
                ariaLabel="Custom CSS editor"
              />
            </div>
            {sourceMode && customCss.trim() === "" && (
              <p className="mt-1 text-xs text-subtle">
                Tip: use the <span className="text-muted">var(--color-*)</span>{" "}
                variables below so your styles adapt to light/dark mode.
              </p>
            )}
            {!sourceMode && (
              <p className="mt-1 text-xs text-subtle">
                Custom CSS is an HTML-mode feature. Switch to HTML source ({"</>"})
                to enable editing.
              </p>
            )}
            <details className="mt-2 text-xs">
              <summary className="text-subtle cursor-pointer hover:text-muted">
                Available CSS variables
              </summary>
              <div className="mt-2 p-3 border border-border rounded-md bg-tag-bg font-mono text-xs text-muted space-y-1">
                <p><span className="text-foreground">var(--color-background)</span> - page background</p>
                <p><span className="text-foreground">var(--color-foreground)</span> - main text</p>
                <p><span className="text-foreground">var(--color-accent)</span> - warm terracotta</p>
                <p><span className="text-foreground">var(--color-border)</span> - divider lines</p>
                <p><span className="text-foreground">var(--color-subtle)</span> - secondary text</p>
                <p><span className="text-foreground">var(--color-muted)</span> - muted text</p>
                <p><span className="text-foreground">var(--color-overlay)</span> - subtle hover</p>
                <p><span className="text-foreground">var(--color-tag-bg)</span> - code block bg</p>
                <p className="text-subtle mt-1">These automatically adapt to light/dark mode.</p>
              </div>
            </details>
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

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-dialog-title">
          <div className={`w-full ${isHtmlCss ? "max-w-7xl" : "max-w-2xl"} max-h-[90vh] overflow-y-auto mx-4 bg-background border border-border rounded-lg shadow-lg`}>
            <div className="sticky top-0 relative z-10 flex items-center justify-between px-6 py-3 border-b border-border bg-background">
              <h2 id="preview-dialog-title" className="text-sm font-medium text-foreground">
                Preview
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-[10px]" role="group" aria-label="Preview theme">
                  {(["system", "light", "dark"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPreviewTheme(t)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${previewTheme === t ? "bg-tag-bg text-foreground" : "text-muted hover:text-foreground"}`}
                    >
                      {t === "system" ? "System" : t === "light" ? "Light" : "Dark"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-0.5 text-[10px]" role="group" aria-label="Preview zoom">
                  {[50, 75, 100].map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setPreviewZoom(z)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${previewZoom === z ? "bg-tag-bg text-foreground" : "text-muted hover:text-foreground"}`}
                    >
                      {z}%
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowPreview(false);
                    doSave("public");
                  }}
                >
                  Publish
                </Button>
              </div>
            </div>
            <div
              className={`px-6 py-6 overflow-hidden bg-background ${previewTheme === "dark" ? "preview-dark" : previewTheme === "light" ? "preview-light" : ""}`}
              style={previewThemeStyle(previewTheme)}
            >
              <h1 className="font-serif text-2xl font-bold text-foreground mb-2">
                {title || "Untitled"}
              </h1>
              <div className="flex items-center gap-2 text-xs text-subtle mb-6">
                <span>{user?.username ?? "you"}</span>
                {emotion && (
                  <>
                    <span>·</span>
                    <span className="text-accent">{emotion}</span>
                  </>
                )}
              </div>

              {tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-6">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-2 py-0.5 rounded text-xs bg-tag-bg text-muted"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ zoom: previewZoom / 100 } as React.CSSProperties}>
                {isHtmlCss ? (
                  <ResizableDiaryWindow naturalWidth={previewNaturalWidth}>
                    <IsolatedDiary
                      html={sanitizeHtml(
                        resolveMediaUrlsInHtml(
                          customCss
                            ? `<style>${sanitizeCss(customCss)}</style>${contentHtml}`
                            : contentHtml
                        ),
                        { allowExternalImages }
                      )}
                      onContentWidth={handlePreviewContentWidth}
                    />
                  </ResizableDiaryWindow>
                ) : (
                  <article
                    className={`${PROSE_CLASSES} max-w-none overflow-x-auto`}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(
                        resolveMediaUrlsInHtml(
                          customCss
                            ? `<style>${sanitizeCss(customCss)}</style>${contentHtml}`
                            : contentHtml
                        ),
                        { allowExternalImages }
                      ),
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showKeySetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="End-to-end encryption setup">
          <div className="w-full max-w-md mx-4 bg-background border border-border rounded-lg shadow-lg p-6">
            {keySetupStep === "explain" ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-accent" />
                  <h2 id="key-setup-title" className="text-lg font-semibold text-foreground">
                    Set Up End-to-End Encryption
                  </h2>
                </div>
                <div className="text-sm text-muted space-y-3 mb-6">
                  <p>
                    Your diary content will be encrypted in your browser before
                    being sent to the server. A master encryption key will be
                    generated and stored (encrypted with your password) on our
                    servers.
                  </p>
                  <p className="text-destructive font-medium">
                    If you lose your password and have no recovery email, your
                    private diaries cannot be recovered. There is no backdoor.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowKeySetup(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setKeySetupStep("password")}
                  >
                    Continue
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-accent" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Enter Your Password
                  </h2>
                </div>
                <p className="text-sm text-muted mb-4">
                  Your master key will be encrypted with your account password.
                  Enter it below to generate and secure your encryption key.
                </p>
                <Input
                  type="password"
                  value={setupInput}
                  onChange={(e) => {
                    setSetupInput(e.target.value);
                    setSetupError("");
                  }}
                  placeholder="Your account password"
                  className="mb-2"
                />
                {setupError && (
                  <p className="text-xs text-destructive mb-2">{setupError}</p>
                )}
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowKeySetup(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!setupInput || isKeyLoading}
                    onClick={async () => {
                      try {
                        await setupMasterKey(setupInput);
                        setPrivacy("private");
                        setShowKeySetup(false);
                        setSetupInput("");
                        setSetupError("");
                        setKeySetupStep("explain");
                      } catch (err: unknown) {
                        const msg =
                          err instanceof Error
                            ? err.message
                            : "Failed to set up encryption";
                        setSetupError(msg);
                      }
                    }}
                  >
                    {isKeyLoading ? "Generating..." : "Generate Key"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <MediaGalleryModal
        editor={editor}
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        onInsertItem={handleSourceGalleryInsert}
      />
      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onApply={applyTemplate}
      />
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