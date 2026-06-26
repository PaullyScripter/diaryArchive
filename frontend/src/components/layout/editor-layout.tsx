import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center gap-4 border-b border-border px-4">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <span className="text-sm font-serif font-semibold">DiaryArchive</span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
