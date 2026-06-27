"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface DraftData {
  title: string;
  contentHtml: string;
  contentText: string;
  tags: string[];
  emotion: string;
  privacy: string;
  commentsEnabled: boolean;
  contentWarnings: string[];
  updatedAt: number;
}

const DRAFT_KEY = "diaryarchive-draft";
const DEBOUNCE_MS = 5000;

export function useDraft() {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const data = JSON.parse(saved) as DraftData;
        setDraft(data);
        setHasRecoveredDraft(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((data: DraftData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
        setDraft(data);
      } catch {
        // localStorage might be full or blocked
      }
    }, DEBOUNCE_MS);
  }, []);

  const discard = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft(null);
    setHasRecoveredDraft(false);
    setTick((t) => t + 1);
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft(null);
    setHasRecoveredDraft(false);
  }, []);

  return {
    draft,
    hasRecoveredDraft,
    persist,
    discard,
    clear,
  };
}