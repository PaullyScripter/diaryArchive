"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ListPlus, Pencil, Trash2 } from "lucide-react";

import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  addChapter,
  deleteChapter,
  focusChapterTitle,
  getChapters,
  jumpToChapter,
  moveChapter,
  type Chapter,
} from "@/lib/editor/chapters";

interface ChapterManagerProps {
  editor: Editor | null;
}

export function ChapterManager({ editor }: ChapterManagerProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const refresh = () => {
      if (!editor || editor.isDestroyed) return;
      const list = getChapters(editor);
      setChapters(list);
      const { from } = editor.state.selection;
      let active = list.findIndex((c) => from >= c.startPos && from < c.endPos);
      if (active === -1) active = list.length - 1;
      setActiveIndex(active);
    };
    refresh();
    editor.on("transaction", refresh);
    editor.on("selectionUpdate", refresh);
    return () => {
      editor.off("transaction", refresh);
      editor.off("selectionUpdate", refresh);
    };
  }, [editor]);

  if (!editor || editor.isDestroyed) return null;

  const handleAdd = () => {
    addChapter(editor);
    editor.chain().focus().run();
  };

  return (
    <aside
      aria-label="Chapters"
      className="border border-border rounded-md bg-background overflow-hidden self-start w-full lg:w-60"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
          Chapters
        </h3>
        <button
          type="button"
          onClick={handleAdd}
          title="Add chapter"
          aria-label="Add chapter"
          className="p-1 rounded transition-colors text-muted hover:text-foreground hover:bg-overlay cursor-pointer"
        >
          <ListPlus className="w-4 h-4" />
        </button>
      </div>

      {chapters.length === 0 ? (
        <div className="px-3 py-4 text-xs text-subtle">
          <p className="mb-2">
            A diary can be split into chapters. Start with an H1 heading to
            begin one.
          </p>
          <button
            type="button"
            onClick={handleAdd}
            className="text-xs text-link hover:underline cursor-pointer"
          >
            Add first chapter
          </button>
        </div>
      ) : (
        <ul className="max-h-[320px] overflow-y-auto divide-y divide-border">
          {chapters.map((chapter, i) => {
            const isActive = i === activeIndex;
            return (
              <li key={chapter.id} className={isActive ? "bg-accent-soft" : ""}>
                <div className="flex items-center gap-1 px-2 py-1.5 group">
                  <button
                    type="button"
                    onClick={() => jumpToChapter(editor, i)}
                    title="Jump to chapter"
                    className="flex-1 min-w-0 text-left text-sm text-foreground truncate px-1 py-0.5 rounded hover:bg-overlay cursor-pointer"
                  >
                    {chapter.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => focusChapterTitle(editor, i)}
                    title="Rename chapter"
                    aria-label={`Rename ${chapter.title}`}
                    className="p-1 rounded text-muted hover:text-foreground hover:bg-overlay cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveChapter(editor, i, -1)}
                    disabled={i === 0}
                    title="Move chapter up"
                    aria-label={`Move ${chapter.title} up`}
                    className="p-1 rounded text-muted hover:text-foreground hover:bg-overlay cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveChapter(editor, i, 1)}
                    disabled={i === chapters.length - 1}
                    title="Move chapter down"
                    aria-label={`Move ${chapter.title} down`}
                    className="p-1 rounded text-muted hover:text-foreground hover:bg-overlay cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (chapters.length > 1) {
                        const ok = await confirmDialog({
                          title: `Delete chapter "${chapter.title}"?`,
                          description: "Its content will be removed.",
                          confirmLabel: "Delete",
                          variant: "destructive",
                        });
                        if (!ok) return;
                      }
                      deleteChapter(editor, i);
                    }}
                    title="Delete chapter"
                    aria-label={`Delete ${chapter.title}`}
                    className="p-1 rounded text-muted hover:text-destructive hover:bg-overlay cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
