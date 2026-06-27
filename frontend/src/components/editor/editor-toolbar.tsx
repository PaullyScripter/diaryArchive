"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  List,
  ListOrdered,
  ListChecks,
  Undo2,
  Redo2,
} from "lucide-react";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const buttons: Array<{
    icon: typeof Bold;
    action: () => void;
    isActive: () => boolean;
    label: string;
    shortcut: string;
  }> = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), isActive: () => editor.isActive("bold"), label: "Bold", shortcut: "Ctrl+B" },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), isActive: () => editor.isActive("italic"), label: "Italic", shortcut: "Ctrl+I" },
    { icon: Underline, action: () => editor.chain().focus().toggleUnderline().run(), isActive: () => editor.isActive("underline"), label: "Underline", shortcut: "Ctrl+U" },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), isActive: () => editor.isActive("strike"), label: "Strikethrough", shortcut: "Ctrl+Shift+S" },
    { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => editor.isActive("heading", { level: 1 }), label: "Heading 1", shortcut: "Ctrl+Shift+1" },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.isActive("heading", { level: 2 }), label: "Heading 2", shortcut: "Ctrl+Shift+2" },
    { icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.isActive("heading", { level: 3 }), label: "Heading 3", shortcut: "Ctrl+Shift+3" },
    { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), isActive: () => editor.isActive("blockquote"), label: "Quote", shortcut: "Ctrl+Shift+B" },
    { icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: () => editor.isActive("codeBlock"), label: "Code Block", shortcut: "Ctrl+Shift+C" },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), isActive: () => editor.isActive("bulletList"), label: "Bullet List", shortcut: "Ctrl+Shift+8" },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), isActive: () => editor.isActive("orderedList"), label: "Numbered List", shortcut: "Ctrl+Shift+7" },
    { icon: ListChecks, action: () => editor.chain().focus().toggleTaskList().run(), isActive: () => editor.isActive("taskList"), label: "Check List", shortcut: "Ctrl+Shift+9" },
    { icon: Undo2, action: () => editor.chain().focus().undo().run(), isActive: () => false, label: "Undo", shortcut: "Ctrl+Z" },
    { icon: Redo2, action: () => editor.chain().focus().redo().run(), isActive: () => false, label: "Redo", shortcut: "Ctrl+Shift+Z" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-0.5 border border-border rounded-md bg-background px-2 py-1.5 mb-2">
      {buttons.map((btn, i) => {
        const active = btn.isActive();
        const disabled =
          (btn.label === "Undo" && !editor.can().undo()) ||
          (btn.label === "Redo" && !editor.can().redo());

        return (
          <div key={btn.label} className="flex items-center">
            {(i === 4 || i === 8 || i === 12) && (
              <div className="w-px h-5 bg-border mx-1" />
            )}
            <button
              type="button"
              onClick={btn.action}
              disabled={disabled}
              title={`${btn.label} (${btn.shortcut})`}
              aria-label={btn.label}
              aria-pressed={active}
              className={`p-1.5 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-foreground hover:bg-overlay"
              }`}
            >
              <btn.icon className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}