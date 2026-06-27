"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface FloatingToolbarProps {
  editor: Editor | null;
}

export function FloatingToolbar({ editor }: FloatingToolbarProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor) return;

    const updatePos = () => {
      const { state } = editor;
      const { from, to, empty } = state.selection;
      if (empty) {
        setShow(false);
        return;
      }

      const coords = editor.view.coordsAtPos(from);
      const toCoords = editor.view.coordsAtPos(to);
      const top = Math.min(coords.top, toCoords.top);
      const left =
        (Math.min(coords.left, toCoords.left) +
          Math.max(coords.right, toCoords.right)) /
        2;

      const editorRect = editor.view.dom.getBoundingClientRect();
      setShow(true);
      setPos({
        top: top - editorRect.top - 48,
        left: left - editorRect.left,
      });
    };

    editor.on("selectionUpdate", updatePos);
    editor.on("blur", () => setShow(false));
    return () => {
      editor.off("selectionUpdate", updatePos);
    };
  }, [editor]);

  if (!editor || !show) return null;

  const buttons = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { icon: Underline, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive("underline") },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike") },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
  ];

  return (
    <div
      className="absolute z-10 flex items-center gap-0.5 border border-border rounded-md bg-background shadow-md px-1 py-1"
      style={{ top: `${pos.top}px`, left: `${pos.left}px`, transform: "translateX(-50%)" }}
    >
      {buttons.map((btn, i) => (
        <button
          key={i}
          type="button"
          onClick={btn.action}
          className={`p-1 rounded transition-colors cursor-pointer ${
            btn.active
              ? "text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          <btn.icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}