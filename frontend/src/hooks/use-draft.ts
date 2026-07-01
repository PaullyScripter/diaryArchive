"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";

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

function getDraftKey(userId: string): string {
  return `diaryarchive-draft:${userId}`;
}

export function useDraft() {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(getDraftKey(userId));
      if (saved) {
        const data = JSON.parse(saved) as DraftData;
        setDraft(data);
        setHasRecoveredDraft(true);
      }
    } catch {
      // ignore
    }
  }, [userId]);

  const persist = useCallback((data: DraftData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!userId) return;
      try {
        localStorage.setItem(getDraftKey(userId), JSON.stringify(data));
        setDraft(data);
      } catch {
        // localStorage might be full or blocked
      }
    }, DEBOUNCE_MS);
  }, [userId]);

  const discard = useCallback(() => {
    if (!userId) return;
    try {
      localStorage.removeItem(getDraftKey(userId));
    } catch {
      // ignore
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft(null);
    setHasRecoveredDraft(false);
    setTick((t) => t + 1);
  }, [userId]);

  const clear = useCallback(() => {
    if (!userId) return;
    try {
      localStorage.removeItem(getDraftKey(userId));
    } catch {
      // ignore
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft(null);
    setHasRecoveredDraft(false);
  }, [userId]);

  return {
    draft,
    hasRecoveredDraft,
    persist,
    discard,
    clear,
  };
}