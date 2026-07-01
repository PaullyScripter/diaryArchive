import Link from "next/link";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit-logs", label: "Audit Logs" },
  { href: "/admin/health", label: "Health" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-44 flex-col border-r border-border md:flex">
        <div className="flex h-8 items-center border-b border-border px-3">
          <Link href="/admin" className="text-xs font-medium text-foreground no-underline">
            DiaryArchive <span className="text-accent ml-1">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 p-2">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-2 py-1 text-xs text-muted hover:text-foreground hover:bg-overlay no-underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-8 items-center border-b border-border px-4">
          <span className="text-xs text-muted">Admin Dashboard</span>
        </header>
        <main id="main-content" className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
