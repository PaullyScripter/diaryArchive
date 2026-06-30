"use client";

import { useEffect, useState, useCallback } from "react";

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

  useEffect(() => {
    listeners.add(setToast);
    return () => { listeners.delete(setToast); };
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div className="pointer-events-auto px-4 py-2.5 rounded-md bg-foreground text-background text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2">
        {toast.message}
      </div>
    </div>
  );
}
