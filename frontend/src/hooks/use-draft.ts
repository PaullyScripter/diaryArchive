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

const DEBOUNCE_MS = 5000;

export function useDraft() {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = useAuthStore((s) => s.user?.id);

  // Never recover plaintext diary content from browser storage. Private
  // entries must remain confidential even on a shared browser profile.
  // Durable recovery is provided by server-side draft diaries; this hook only
  // retains an in-memory recovery candidate for the current tab.
  useEffect(() => {
    setDraft(null);
    setHasRecoveredDraft(false);
  }, [userId]);

  const persist = useCallback((data: DraftData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!userId) return;
      setDraft(data);
      setHasRecoveredDraft(true);
    }, DEBOUNCE_MS);
  }, [userId]);

  const discard = useCallback(() => {
    if (!userId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft(null);
    setHasRecoveredDraft(false);
    setTick((t) => t + 1);
  }, [userId]);

  const clear = useCallback(() => {
    if (!userId) return;
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
