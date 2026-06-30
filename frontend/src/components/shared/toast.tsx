"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Toast {
  id: number;
  message: string;
}

let nextId = 0;
const listeners = new Set<(toast: Toast | null) => void>();

export function showToast(message: string) {
  const toast = { id: ++nextId, message };
  listeners.forEach((fn) => fn(toast));
}

export function ToastContainer() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listeners.add(setToast);
    return () => { listeners.delete(setToast); };
  }, []);

  const dismiss = useCallback(() => {
    setLeaving(true);
    timerRef.current = setTimeout(() => {
      setToast(null);
      setLeaving(false);
    }, 200);
  }, []);

  useEffect(() => {
    if (!toast) return;
    setLeaving(false);
    timerRef.current = setTimeout(dismiss, 4000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, dismiss]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`pointer-events-auto px-4 py-2.5 rounded-md bg-foreground text-background text-sm shadow-lg transition-opacity duration-200 ${
          leaving ? "opacity-0" : "opacity-100 animate-in fade-in slide-in-from-bottom-2"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}
