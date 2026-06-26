import Link from "next/link";

export interface DiaryEntryData {
  id: string;
  title: string;
  author: { username: string; id: string };
  publishedAt: string;
  readingTime: number;
  commentCount: number;
  isPublic: boolean;
  tags: string[];
  emotion?: string;
  excerpt?: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}wk ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function DiaryEntry({ entry }: { entry: DiaryEntryData }) {
  return (
    <article className="py-3 border-b border-border last:border-b-0 transition-colors hover:bg-overlay -mx-4 px-4 rounded-sm">
      <div className="max-w-prose">
        <Link
          href={`/diary/${entry.id}`}
          className="text-lg font-serif font-semibold text-foreground leading-snug no-underline hover:underline hover:decoration-from-font"
        >
          {entry.title}
        </Link>

        <div className="mt-0.5 text-xs text-muted">
          <Link
            href={`/profile/${entry.author.id}`}
            className="text-muted hover:text-foreground no-underline hover:underline"
          >
            {entry.author.username}
          </Link>
          <span className="mx-1">·</span>
          <span>{relativeTime(entry.publishedAt)}</span>
          <span className="mx-1">·</span>
          <span>{entry.readingTime} min read</span>
          <span className="mx-1">·</span>
          <Link
            href={`/diary/${entry.id}#comments`}
            className="text-muted hover:text-foreground no-underline hover:underline"
          >
            {entry.commentCount} {entry.commentCount === 1 ? "comment" : "comments"}
          </Link>
          {!entry.isPublic && (
            <>
              <span className="mx-1">·</span>
              <span className="text-accent" title="Private">🔒</span>
            </>
          )}
        </div>

        {entry.tags.length > 0 && (
          <div className="mt-1 text-xs">
            {entry.tags.map((tag) => (
              <span key={tag}>
                <Link
                  href={`/explore?tag=${tag}`}
                  className="text-link hover:text-link-hover no-underline hover:underline"
                >
                  #{tag}
                </Link>{" "}
              </span>
            ))}
            {entry.emotion && (
              <span className="text-accent text-xs font-medium ml-1">
                {entry.emotion}
              </span>
            )}
          </div>
        )}

        {entry.excerpt && (
          <p className="mt-1.5 text-sm text-foreground leading-relaxed line-clamp-2">
            {entry.excerpt}
          </p>
        )}
      </div>
    </article>
  );
}
