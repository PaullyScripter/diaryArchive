"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/shared/icons";
import { usePopularTags, useEmotions } from "@/hooks/use-diaries";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2023 }, (_, i) => String(currentYear - i));

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
  const { data: tagsData } = usePopularTags();
  const { data: emotionsData } = useEmotions();
  const [tagSearch, setTagSearch] = useState("");

  const tags = tagsData ?? [];
  const emotions = emotionsData?.data ?? [];

  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return tags;
    const q = tagSearch.toLowerCase();
    return tags.filter((t) => t.tag.toLowerCase().includes(q));
  }, [tags, tagSearch]);

  return (
    <aside className="w-44 shrink-0 hidden lg:block">
      <nav aria-label="Browse the archive">
        <p className="text-[10px] text-subtle uppercase tracking-wider mb-2">Browse</p>

        <CollapsibleSection title="Tags">
          <div className="relative mb-2">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-subtle pointer-events-none" />
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags..."
              className="w-full pl-6 pr-2 py-1 rounded-sm text-xs bg-overlay border border-border text-foreground placeholder:text-subtle focus:outline-none focus:border-accent"
            />
          </div>
          {filteredTags.map((tag) => (
            <div key={tag.tag}>
              <Link
                href={`/explore?tags=${tag.tag}`}
                className="text-xs text-muted hover:text-foreground no-underline hover:underline"
              >
                {tag.tag}
                <span className="text-subtle ml-1">({tag.count})</span>
              </Link>
            </div>
          ))}
          {tagSearch.trim() && filteredTags.length === 0 && (
            <p className="text-xs text-muted">No tags found.</p>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Emotions">
          {emotions.map((emotion) => (
            <div key={emotion.emotion}>
              <Link
                href={`/explore?emotion=${emotion.emotion}`}
                className="text-xs text-muted hover:text-foreground no-underline hover:underline"
              >
                {emotion.emotion}
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
                    href={`/explore?year=${currentYear}&month=${idx + 1}`}
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
