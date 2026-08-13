"use client";

import { useEffect, useState } from "react";

export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section id={slugify(title)} className="mb-10 scroll-mt-20">
      <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background p-5 mb-5 shadow-sm">
      {children}
    </div>
  );
}

export function WarningCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50 p-5 my-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-2">
        Important
      </p>
      {children}
    </div>
  );
}

export function DataTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-overlay/5" : ""}>
              <td className="px-4 py-2.5 border-b border-border/50 font-medium text-foreground whitespace-nowrap">
                {row.label}
              </td>
              <td className="px-4 py-2.5 border-b border-border/50 text-muted">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalDocShell({
  title,
  subtitle,
  updated,
  sections,
  children,
}: {
  title: string;
  subtitle: string;
  updated: string;
  sections: string[];
  children: React.ReactNode;
}) {
  const [active, setActive] = useState("");

  useEffect(() => {
    const ids = sections.map((s) => slugify(s));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="mx-auto flex max-w-6xl gap-8 py-8">
      <nav className="hidden lg:block w-52 shrink-0">
        <div className="sticky top-20">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle mb-3">
            On this page
          </p>
          <ul className="space-y-1 border-l border-border">
            {sections.map((section) => {
              const id = slugify(section);
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`block py-1 pl-3 text-xs leading-relaxed transition-colors border-l -ml-px ${
                      active === id
                        ? "border-accent text-accent font-medium"
                        : "border-transparent text-muted hover:text-foreground hover:border-border"
                    }`}
                  >
                    {section}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-1">{title}</h1>
          <p className="text-sm text-subtle">{subtitle}</p>
          <p className="text-sm text-subtle mt-1">Last updated - {updated}</p>
        </div>

        {children}
      </div>
    </div>
  );
}