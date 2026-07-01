"use client";

import { NavBar } from "@/components/layout/navbar";
import { ToastContainer } from "@/components/shared/toast";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <ToastContainer />
    </div>
  );
}
