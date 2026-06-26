"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-sm pt-24 px-4 text-center">
      <h1 className="font-serif text-xl mb-2">Something went wrong</h1>
      <p className="text-sm text-muted mb-6">
        We&apos;ve been notified. Please try again.
      </p>
      <button
        onClick={() => reset()}
        className="text-sm text-link hover:text-link-hover underline underline-offset-2 cursor-pointer"
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
