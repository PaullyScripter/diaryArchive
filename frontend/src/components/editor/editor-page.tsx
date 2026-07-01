"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Eye, Lock, Shield } from "lucide-react";

import { useCreateDiary, useUpdateDiary, useDeleteDiary } from "@/hooks/use-diaries";
import { useDiary } from "@/hooks/use-diaries";
import { useMasterKey } from "@/hooks/use-master-key";
import { sanitizeHtml, sanitizeCss } from "@/lib/sanitize";
import { encryptDiary } from "@/lib/crypto";
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
  const [setupInput, setSetupInput] = useState("");
  const [setupError, setSetupError] = useState("");
  const [keySetupStep, setKeySetupStep] = useState<"explain" | "password">("explain");
  const saveRef = useRef<() => Promise<void>>(async () => {});

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
            contentHtml: customCss
              ? `<style>${sanitizeCss(customCss)}</style>${contentHtml}`
              : contentHtml,
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
          content_html: customCss
            ? `<style>${customCss}</style>${contentHtml}`
            : contentHtml,
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
            hasMasterKey={isMasterKeyAvailable}
            isEditMode={isEditMode}
            onSetupEncryption={() => setShowKeySetup(true)}
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
            <details className="mt-2 text-xs">
              <summary className="text-subtle cursor-pointer hover:text-muted">
                Available CSS variables
              </summary>
              <div className="mt-2 p-3 border border-border rounded-md bg-tag-bg font-mono text-xs text-muted space-y-1">
                <p><span className="text-foreground">var(--color-background)</span> — page background</p>
                <p><span className="text-foreground">var(--color-foreground)</span> — main text</p>
                <p><span className="text-foreground">var(--color-accent)</span> — warm terracotta</p>
                <p><span className="text-foreground">var(--color-border)</span> — divider lines</p>
                <p><span className="text-foreground">var(--color-subtle)</span> — secondary text</p>
                <p><span className="text-foreground">var(--color-muted)</span> — muted text</p>
                <p><span className="text-foreground">var(--color-overlay)</span> — subtle hover</p>
                <p><span className="text-foreground">var(--color-tag-bg)</span> — code block bg</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 bg-background border border-border rounded-lg shadow-lg">
            <div className="sticky top-0 flex items-center justify-between px-6 py-3 border-b border-border bg-background">
              <h2 className="text-sm font-medium text-foreground">
                Preview
              </h2>
              <div className="flex items-center gap-2">
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
            <div className="px-6 py-6">
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

              <article
                className="font-serif text-base leading-relaxed text-foreground max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-1 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_pre]:bg-tag-bg [&_pre]:text-foreground [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-sm [&_pre]:overflow-x-auto [&_code]:bg-tag-bg [&_code]:text-foreground [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(
                    customCss
                      ? `<style>${sanitizeCss(customCss)}</style>${contentHtml}`
                      : contentHtml
                  ),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showKeySetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 bg-background border border-border rounded-lg shadow-lg p-6">
            {keySetupStep === "explain" ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-accent" />
                  <h2 className="text-lg font-semibold text-foreground">
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