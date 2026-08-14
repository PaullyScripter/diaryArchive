import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import {
  addChapter,
  deleteChapter,
  getChapters,
  moveChapter,
  focusChapterTitle,
} from "@/lib/editor/chapters";

function createEditor(html: string): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [StarterKit],
    content: html,
  });
}

const SAMPLE = [
  "<h1>Morning</h1>",
  "<p>Woke up early.</p>",
  "<h1>Evening</h1>",
  "<p>Walked the dog.</p>",
  "<h1>Night</h1>",
  "<p>Read a book.</p>",
].join("");

describe("chapter helpers", () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor(SAMPLE);
  });

  afterEach(() => {
    editor.destroy();
    document.body.innerHTML = "";
  });

  it("detects chapters split by H1 headings", () => {
    const chapters = getChapters(editor);
    expect(chapters.map((c) => c.title)).toEqual(["Morning", "Evening", "Night"]);
    const [first, second] = chapters;
    expect(first.startPos).toBeLessThan(second.startPos);
    expect(first.endPos).toBeLessThanOrEqual(second.startPos);
  });

  it("adds a chapter at the end of the document", () => {
    addChapter(editor, "Tomorrow");
    const chapters = getChapters(editor);
    expect(chapters.map((c) => c.title)).toEqual([
      "Morning",
      "Evening",
      "Night",
      "Tomorrow",
    ]);
  });

  it("deletes a chapter and its content", () => {
    deleteChapter(editor, 1);
    const chapters = getChapters(editor);
    expect(chapters.map((c) => c.title)).toEqual(["Morning", "Night"]);
    expect(editor.getText()).not.toContain("Walked the dog.");
  });

  it("moves a chapter up", () => {
    moveChapter(editor, 1, -1);
    const chapters = getChapters(editor);
    expect(chapters.map((c) => c.title)).toEqual([
      "Evening",
      "Morning",
      "Night",
    ]);
  });

  it("moves a chapter down", () => {
    moveChapter(editor, 0, 1);
    const chapters = getChapters(editor);
    expect(chapters.map((c) => c.title)).toEqual([
      "Evening",
      "Morning",
      "Night",
    ]);
  });

  it("focuses the title of a chapter when renaming", () => {
    focusChapterTitle(editor, 1);
    const { from, to, empty } = editor.state.selection;
    expect(empty).toBe(false);
    expect(editor.state.doc.textBetween(from, to)).toBe("Evening");
  });
});