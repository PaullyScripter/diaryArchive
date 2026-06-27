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
          "min-h-[300px] font-serif text-base leading-relaxed text-foreground focus:outline-none px-4 py-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-1 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_pre]:bg-tag-bg [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-sm [&_pre]:text-foreground [&_pre]:overflow-x-auto [&_code]:bg-tag-bg [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:text-foreground [&_code]:font-mono [&_hr]:border-border [&_hr]:my-4",
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