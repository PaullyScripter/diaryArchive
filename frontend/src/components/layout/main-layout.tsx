"use client";

import Link from "next/link";
import { NavBar } from "@/components/layout/navbar";
import { ToastContainer } from "@/components/shared/toast";
import { ConfirmDialogContainer } from "@/components/ui/confirm-dialog";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-muted">
          <span>DiaryArchive - Privacy is a human right</span>
          <nav className="flex gap-4" aria-label="Footer navigation">
            <Link href="/policy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/policy/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/policy/advanced-editor" className="hover:text-foreground transition-colors">
              Advanced Editor
            </Link>
          </nav>
        </div>
      </footer>
      <ToastContainer />
      <ConfirmDialogContainer />
    </div>
  );
}
