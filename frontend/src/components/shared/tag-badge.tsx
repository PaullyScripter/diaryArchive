import Link from "next/link";

export function TagBadge({ tag, active }: { tag: string; active?: boolean }) {
  return (
    <Link
      href={`/explore?tags=${tag}`}
      className={`inline-block px-1.5 py-0.5 rounded-sm text-xs no-underline transition-colors ${
        active
          ? "bg-accent/15 text-accent font-medium ring-1 ring-accent/30"
          : "bg-tag-bg text-muted hover:text-foreground hover:bg-border"
      }`}
    >
      #{tag}
    </Link>
  );
}
