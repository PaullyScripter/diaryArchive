"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "secondary" | "destructive";
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

let active: PendingConfirm | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * In-site replacement for window.confirm / window.alert. Resolves with the
 * user's choice. Only one is shown at a time; a new call while one is open
 * resolves the previous one as false.
 */
export function confirmDialog(
  options: ConfirmOptions | string
): Promise<boolean> {
  const opts =
    typeof options === "string" ? { title: options } : options;
  return new Promise<boolean>((resolve) => {
    if (active) active.resolve(false);
    active = { options: opts, resolve };
    notify();
  });
}

function settle(result: boolean) {
  if (!active) return;
  active.resolve(result);
  active = null;
  notify();
}

/** Mount once (e.g. next to <ToastContainer />) to enable confirmDialog(). */
export function ConfirmDialogContainer() {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (!active) return null;

  const { options } = active;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-base">{options.title}</DialogTitle>
          {options.description && (
            <DialogDescription className="text-sm leading-relaxed">
              {options.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="mt-6 gap-2 sm:space-x-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => settle(false)}
            className="w-full sm:w-auto"
          >
            {options.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            type="button"
            variant={options.variant ?? "primary"}
            size="sm"
            onClick={() => settle(true)}
            className="w-full sm:w-auto"
          >
            {options.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}