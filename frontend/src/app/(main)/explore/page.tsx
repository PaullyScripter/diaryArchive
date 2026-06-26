import Link from "next/link";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; emotion?: string; year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const filters = [params.tag, params.emotion, params.year, params.month].filter(Boolean);

  return (
    <div>
      <div className="mb-5 pb-4 border-b border-border">
        <h1 className="font-serif text-xl font-semibold text-foreground">Explore</h1>
        {filters.length > 0 && (
          <p className="text-xs text-muted mt-0.5">
            Filtered by: {filters.join(", ")}
          </p>
        )}
        {filters.length === 0 && (
          <p className="text-xs text-muted mt-0.5">
            Browse the archive by tag, emotion, or date
          </p>
        )}
      </div>

      {filters.length > 0 && (
        <div className="mb-4">
          <Link
            href="/explore"
            className="text-xs text-muted hover:text-foreground no-underline hover:underline"
          >
            ← Clear filters
          </Link>
        </div>
      )}

      <p className="text-xs text-muted">Results will appear here when connected to the backend.</p>
    </div>
  );
}
