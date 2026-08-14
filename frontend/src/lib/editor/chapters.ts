import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";

const HEADING_LEVEL = 1;

export interface Chapter {
  id: string;
  title: string;
  titleStart: number;
  titleEnd: number;
  startPos: number;
  endPos: number;
}

export function getChapters(editor: Editor): Chapter[] {
  const doc = editor.state.doc;
  const chapters: Chapter[] = [];
  let current: Chapter | null = null;

  doc.forEach((node, offset) => {
    if (node.type.name === "heading" && node.attrs.level === HEADING_LEVEL) {
      if (current) chapters.push(current);
      const titleLength = node.textContent.length;
      current = {
        id: `ch-${offset}`,
        title: node.textContent || "Untitled",
        titleStart: offset + 1,
        titleEnd: offset + 1 + titleLength,
        startPos: offset,
        endPos: offset + node.nodeSize,
      };
    } else if (current) {
      current.endPos = offset + node.nodeSize;
    }
  });
  if (current) chapters.push(current);

  return chapters;
}

export function addChapter(editor: Editor, title = "New Chapter") {
  if (!editor) return;
  const { state, view } = editor;
  const end = state.doc.content.size;
  const { tr } = state;

  const heading = state.schema.nodes.heading.create(
    { level: HEADING_LEVEL },
    state.schema.text(title),
  );
  const paragraph = state.schema.nodes.paragraph.create();

  tr.insert(end, heading);
  tr.insert(end + heading.nodeSize, paragraph);
  tr.setSelection(TextSelection.create(tr.doc, end + 1));
  view.dispatch(tr);
  editor.commands.focus();
}

export function deleteChapter(editor: Editor, index: number) {
  if (!editor) return;
  const chapter = getChapters(editor)[index];
  if (!chapter) return;
  const { view, state } = editor;
  const { tr } = state;
  tr.delete(chapter.startPos, chapter.endPos);
  view.dispatch(tr);
  editor.commands.focus();
}

export function moveChapter(editor: Editor, index: number, direction: -1 | 1) {
  if (!editor) return;
  const chapters = getChapters(editor);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= chapters.length) return;

  const moving = chapters[index];
  const neighbor = chapters[target];
  const { view, state } = editor;
  const { tr } = state;
  const slice = state.doc.slice(moving.startPos, moving.endPos);
  const movingSize = moving.endPos - moving.startPos;

  if (direction === -1) {
    tr.delete(moving.startPos, moving.endPos);
    tr.insert(neighbor.startPos, slice.content);
  } else {
    tr.delete(moving.startPos, moving.endPos);
    tr.insert(neighbor.endPos - movingSize, slice.content);
  }

  view.dispatch(tr);
  editor.commands.focus();
}

export function focusChapterTitle(editor: Editor, index: number) {
  if (!editor) return;
  const chapter = getChapters(editor)[index];
  if (!chapter) return;
  const { view, state } = editor;
  const { tr } = state;
  const titleEnd = Math.min(chapter.titleEnd, tr.doc.content.size);
  tr.setSelection(TextSelection.create(tr.doc, chapter.titleStart, titleEnd));
  view.dispatch(tr);
  editor.commands.focus();
}

export function jumpToChapter(editor: Editor, index: number) {
  if (!editor) return;
  const chapter = getChapters(editor)[index];
  if (!chapter) return;
  const { view, state } = editor;
  const { tr } = state;
  const pos = Math.min(chapter.titleStart, tr.doc.content.size);
  tr.setSelection(TextSelection.create(tr.doc, pos, pos));
  view.dispatch(tr);
  editor.commands.focus();

  const dom = view.nodeDOM(chapter.startPos) as HTMLElement | null;
  dom?.scrollIntoView({ behavior: "smooth", block: "center" });
}
