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
  Code2,
} from "lucide-react";

const FONTS = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times", value: "Times New Roman" },
  { label: "Courier", value: "Courier New" },
  { label: "Verdana", value: "Verdana" },
  { label: "Serif", value: "serif" },
  { label: "Sans", value: "sans-serif" },
  { label: "Mono", value: "monospace" },
];

const FONT_SIZES = [
  "10px", "12px", "14px", "16px", "18px", "20px",
  "24px", "28px", "32px", "36px", "42px", "48px",
];

interface EditorToolbarProps {
  editor: Editor | null;
  sourceMode: boolean;
  onToggleSource: () => void;
}

export function EditorToolbar({ editor, sourceMode, onToggleSource }: EditorToolbarProps) {
  if (!editor || editor.isDestroyed) return null;

  const activeFont =
    (editor.getAttributes("textStyle") as { fontFamily?: string }).fontFamily || "";
  const activeFontSize =
    (editor.getAttributes("textStyle") as { fontSize?: string }).fontSize || "";

  const btnBase =
    "p-1.5 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed";
  const btnActive = "bg-accent-soft text-accent";
  const btnNormal = "text-muted hover:text-foreground hover:bg-overlay";

  return (
    <div className="flex flex-wrap items-center gap-0.5 border border-border rounded-md bg-background px-2 py-1.5 mb-2">
      <select
        value={activeFont}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        className="text-xs bg-background border border-border rounded px-1 py-1 text-muted cursor-pointer mr-1 max-w-[80px]"
      >
        {FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        value={activeFontSize}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontSize(v).run();
          else editor.chain().focus().unsetFontSize().run();
        }}
        className="text-xs bg-background border border-border rounded px-1 py-1 text-muted cursor-pointer mr-1 max-w-[70px]"
      >
        <option value="">Size</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div className="w-px h-5 bg-border mx-1" />

      {[
        { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: () => editor.isActive("bold"), label: "Bold" },
        { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: () => editor.isActive("italic"), label: "Italic" },
        { icon: Underline, action: () => editor.chain().focus().toggleUnderline().run(), active: () => editor.isActive("underline"), label: "Underline" },
        { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: () => editor.isActive("strike"), label: "Strikethrough" },
      ].map((btn) => (
        <button
          key={btn.label}
          type="button"
          onClick={btn.action}
          title={btn.label}
          aria-label={btn.label}
          aria-pressed={btn.active()}
          className={`${btnBase} ${btn.active() ? btnActive : btnNormal}`}
        >
          <btn.icon className="w-3.5 h-3.5" />
        </button>
      ))}

      <div className="w-px h-5 bg-border mx-1" />

      {[
        { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: () => editor.isActive("heading", { level: 1 }), label: "H1" },
        { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: () => editor.isActive("heading", { level: 2 }), label: "H2" },
        { icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: () => editor.isActive("heading", { level: 3 }), label: "H3" },
      ].map((btn) => (
        <button
          key={btn.label}
          type="button"
          onClick={btn.action}
          title={btn.label}
          aria-label={btn.label}
          aria-pressed={btn.active()}
          className={`${btnBase} ${btn.active() ? btnActive : btnNormal}`}
        >
          <btn.icon className="w-3.5 h-3.5" />
        </button>
      ))}

      <div className="w-px h-5 bg-border mx-1" />

      {[
        { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: () => editor.isActive("blockquote"), label: "Quote" },
        { icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), active: () => editor.isActive("codeBlock"), label: "Code" },
        { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: () => editor.isActive("bulletList"), label: "Bullet List" },
        { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: () => editor.isActive("orderedList"), label: "Numbered List" },
        { icon: ListChecks, action: () => editor.chain().focus().toggleTaskList().run(), active: () => editor.isActive("taskList"), label: "Check List" },
      ].map((btn) => (
        <button
          key={btn.label}
          type="button"
          onClick={btn.action}
          title={btn.label}
          aria-label={btn.label}
          aria-pressed={btn.active()}
          className={`${btnBase} ${btn.active() ? btnActive : btnNormal}`}
        >
          <btn.icon className="w-3.5 h-3.5" />
        </button>
      ))}

      <div className="w-px h-5 bg-border mx-1" />

      {[
        { icon: Undo2, action: () => editor.chain().focus().undo().run(), disabled: !editor.can().undo(), label: "Undo" },
        { icon: Redo2, action: () => editor.chain().focus().redo().run(), disabled: !editor.can().redo(), label: "Redo" },
      ].map((btn) => (
        <button
          key={btn.label}
          type="button"
          onClick={btn.action}
          disabled={btn.disabled}
          title={btn.label}
          aria-label={btn.label}
          className={`${btnBase} ${btnNormal}`}
        >
          <btn.icon className="w-3.5 h-3.5" />
        </button>
      ))}

      <div className="w-px h-5 bg-border mx-1" />

      <button
        type="button"
        onClick={onToggleSource}
        title="Toggle source code view"
        aria-label="Source code"
        className={`${btnBase} ${sourceMode ? btnActive : btnNormal}`}
      >
        <Code2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
