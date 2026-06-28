"use client";

import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/layout/navbar";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-4">
          <button
            onClick={handleBack}
            aria-label="Go back"
            className="text-muted hover:text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
            type="button"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}