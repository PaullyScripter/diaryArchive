import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 md:flex-row md:justify-between md:px-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4 text-primary" />
          <span>DiaryArchive</span>
          <span className="hidden md:inline">&mdash; A place for your thoughts. Public or private.</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="https://github.com" className="hover:text-foreground transition-colors">
            GitHub
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <span>Built with care</span>
        </div>
      </div>
    </footer>
  );
}
