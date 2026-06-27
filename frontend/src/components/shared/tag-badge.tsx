import Link from "next/link";

export function TagBadge({ tag }: { tag: string }) {
  return (
    <Link
      href={`/explore?tag=${tag}`}
      className="inline-block px-1.5 py-0.5 rounded-sm text-xs bg-tag-bg text-muted hover:text-foreground no-underline hover:bg-border transition-colors"
    >
      #{tag}
    </Link>
  );
}
