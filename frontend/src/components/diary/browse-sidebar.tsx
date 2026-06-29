"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/shared/icons";

const tags = [
  { name: "life", count: 42 },
  { name: "reflection", count: 28 },
  { name: "poetry", count: 15 },
  { name: "travel", count: 12 },
  { name: "mental-health", count: 8 },
  { name: "relationships", count: 6 },
  { name: "work", count: 5 },
  { name: "family", count: 4 },
  { name: "art", count: 3 },
];

const emotions = [
  { name: "grateful" },
  { name: "reflective" },
  { name: "hopeful" },
  { name: "melancholy" },
  { name: "anxious" },
  { name: "joyful" },
];

const years = ["2026", "2025", "2024"];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-foreground uppercase tracking-wider cursor-pointer"
        type="button"
      >
        <span className="text-subtle text-[10px]">
          {open ? <ChevronDownIcon className="inline-block" /> : <ChevronRightIcon className="inline-block" />}
        </span>
        {title}
      </button>
      {open && <div className="mt-1 ml-3 space-y-0.5">{children}</div>}
    </div>
  );
}

export function BrowseSidebar() {
  return (
    <aside className="w-44 shrink-0 hidden lg:block">
      <nav aria-label="Browse the archive">
        <p className="text-[10px] text-subtle uppercase tracking-wider mb-2">Browse</p>

        <CollapsibleSection title="Tags">
          {tags.map((tag) => (
            <div key={tag.name}>
              <Link
                href={`/explore?tags=${tag.name}`}
                className="text-xs text-muted hover:text-foreground no-underline hover:underline"
              >
                {tag.name}
                <span className="text-subtle ml-1">({tag.count})</span>
              </Link>
            </div>
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Emotions">
          {emotions.map((emotion) => (
            <div key={emotion.name}>
              <Link
                href={`/explore?emotion=${emotion.name}`}
                className="text-xs text-muted hover:text-foreground no-underline hover:underline"
              >
                {emotion.name}
              </Link>
            </div>
          ))}
        </CollapsibleSection>

        <div className="mt-5 mb-2">
          <p className="text-[10px] text-subtle uppercase tracking-wider mb-2">By Date</p>

          <CollapsibleSection title="Years">
            {years.map((year) => (
              <div key={year}>
                <Link
                  href={`/explore?year=${year}`}
                  className="text-xs text-muted hover:text-foreground no-underline hover:underline"
                >
                  {year}
                </Link>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Months">
              {months.map((month, idx) => (
                <div key={month}>
                  <Link
                    href={`/explore?year=2026&month=${idx + 1}`}
                    className="text-xs text-muted hover:text-foreground no-underline hover:underline"
                  >
                  {month}
                </Link>
              </div>
            ))}
          </CollapsibleSection>
        </div>
      </nav>

      <div className="mt-6 pt-3 border-t border-border">
        <Link
          href="/diary/random"
          className="text-xs font-medium text-foreground hover:text-link no-underline hover:underline"
        >
          Random Diary
        </Link>
      </div>
    </aside>
  );
}
