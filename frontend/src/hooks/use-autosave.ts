"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutosaveOptions {
  diaryId: string | null;
  title: string;
  contentHtml: string;
  contentText: string;
  privacy: string;
  tags: string[];
  emotion: string;
  commentsEnabled: boolean;
  contentWarnings: string[];
  onSavedId?: (id: string) => void;
}

const DEBOUNCE_MS = 30000;

export function useAutosave({
  diaryId,
  title,
  contentHtml,
  contentText,
  privacy,
  tags,
  emotion,
  commentsEnabled,
  contentWarnings,
  onSavedId,
}: UseAutosaveOptions) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(true);
  const idRef = useRef(diaryId);
  const { apiClient } = require("@/lib/api/client") as typeof import("@/lib/api/client");

  const doSave = useCallback(async () => {
    if (!title.trim() && !contentText.trim()) return;
    setStatus("saving");
    try {
      const payload = {
        privacy,
        title: title.trim() || null,
        content_html: contentHtml,
        content_text: contentText,
        tags,
        emotion: emotion || null,
        comments_enabled: commentsEnabled,
        content_warnings: contentWarnings,
      };
      let response;
      if (idRef.current) {
        response = await apiClient.put(`/diaries/${idRef.current}`, payload);
      } else {
        response = await apiClient.post("/diaries", payload);
        const newId = response.data.data.id;
        idRef.current = newId;
        onSavedId?.(newId);
      }
      setStatus("saved");
      setLastSavedAt(new Date());
    } catch {
      setStatus("error");
    }
  }, [title, contentHtml, contentText, privacy, tags, emotion, commentsEnabled, contentWarnings, onSavedId, apiClient]);

  useEffect(() => {
    idRef.current = diaryId;
  }, [diaryId]);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("idle");
    timerRef.current = setTimeout(() => {
      doSave();
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, contentHtml, contentText, privacy, tags, emotion, commentsEnabled, contentWarnings, doSave]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await doSave();
  }, [doSave]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveNow]);

  useEffect(() => {
    const handler = () => {
      if (status === "idle" || status === "saving") {
        if (title.trim() || contentText.trim()) {
          const payload = JSON.stringify({
            privacy,
            title,
            content_html: contentHtml,
            content_text: contentText,
            tags,
            emotion,
            comments_enabled: commentsEnabled,
            content_warnings: contentWarnings,
            _id: idRef.current,
          });
          navigator.sendBeacon(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/diaries/autosave-beacon`,
            payload,
          );
        }
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status, title, contentHtml, contentText, privacy, tags, emotion, commentsEnabled, contentWarnings]);

  return { status, lastSavedAt, saveNow, currentId: idRef.current };
}