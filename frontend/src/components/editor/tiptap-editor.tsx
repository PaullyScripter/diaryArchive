"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import CharacterCount from "@tiptap/extension-character-count";
import { useEffect } from "react";
import type { Editor } from "@tiptap/react";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string, text: string) => void;
  onEditorReady?: (editor: Editor) => void;
  placeholder?: string;
  editable?: boolean;
}

export function TiptapEditor({
  content,
  onChange,
  onEditorReady,
  placeholder = "What's on your mind?",
  editable = true,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Typography,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      CharacterCount,
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[300px] font-serif text-base leading-relaxed text-foreground focus:outline-none px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getText());
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  return (
    <div className="border border-border rounded-md bg-background overflow-hidden">
      <EditorContent editor={editor} />
    </div>
  );
}