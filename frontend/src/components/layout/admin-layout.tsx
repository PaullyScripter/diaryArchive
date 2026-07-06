"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/bugs", label: "Bugs" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/reports", label: "Content Reports" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/health", label: "Health" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-44 flex-col border-r border-border md:flex">
        <div className="flex h-8 items-center border-b border-border px-3">
          <Link
            href="/admin"
            className="text-xs font-medium text-foreground no-underline"
          >
            DiaryArchive <span className="text-accent ml-1">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 p-2">
          {adminNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-2 py-1 text-xs no-underline transition-colors ${
                  isActive
                    ? "text-foreground font-medium bg-overlay"
                    : "text-muted hover:text-foreground hover:bg-overlay"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="mt-2 border-t border-border pt-2">
            <Link
              href="/"
              className="block px-2 py-1 text-xs text-muted hover:text-foreground no-underline"
            >
              &larr; Back to Site
            </Link>
          </div>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-8 items-center border-b border-border px-4">
          <span className="text-xs text-muted">Admin Dashboard</span>
        </header>
        <main id="main-content" className="flex-1 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
