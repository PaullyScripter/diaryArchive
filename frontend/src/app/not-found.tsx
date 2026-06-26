import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-sm pt-24 px-4 text-center">
      <p className="text-subtle text-sm">404</p>
      <h1 className="font-serif text-xl mt-2 mb-4">This page doesn&apos;t exist</h1>
      <Link href="/" className="text-sm text-link hover:text-link-hover underline underline-offset-2">
        Go home
      </Link>
    </div>
  );
}
