"use client";

import { useEffect, useState } from "react";

interface Toast {
  id: number;
  message: string;
}

let nextId = 0;
const queue: Toast[] = [];
let active: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notifyUpdate() {
  listeners.forEach((fn) => fn());
}

function advanceQueue() {
  if (queue.length > 0) {
    active = queue.shift()!;
    timer = setTimeout(advanceQueue, 4000);
  } else {
    active = null;
  }
  notifyUpdate();
}

export function showToast(message: string) {
  queue.push({ id: ++nextId, message });
  if (!active) advanceQueue();
}

export function ToastContainer() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, []);

  if (!active) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div
        key={active.id}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-auto px-4 py-2.5 rounded-md bg-foreground text-background text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2"
      >
        {active.message}
      </div>
    </div>
  );
}