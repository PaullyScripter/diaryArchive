"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/providers/theme-provider";
import { useAuthStore } from "@/store/auth-store";
import { MenuIcon, MoonIcon, SunIcon, XIcon } from "@/components/shared/icons";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <button
      onClick={() => setTheme(next)}
      className="text-muted hover:text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
      aria-label={`Switch to ${next} mode`}
      type="button"
    >
      {resolvedTheme === "dark" ? <SunIcon className="inline-block" /> : <MoonIcon className="inline-block" />}
    </button>
  );
}

function NavLinks({ vertical = false, onClick }: { vertical?: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore" },
    { href: "/diary/new", label: "Write" },
    { href: "/diary/random", label: "Random" },
  ];

  return (
    <div className={`flex ${vertical ? "flex-col gap-1" : "gap-0"}`}>
      {links.map((link) => {
        const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClick}
            className={`relative text-sm px-2 py-0.5 no-underline transition-colors focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2 ${
              isActive
                ? "text-foreground font-medium"
                : "text-muted hover:text-foreground"
            }`}
          >
            {link.label}
            {isActive && (
              <span className="absolute bottom-[-5px] left-2 right-2 h-[2px] bg-foreground rounded-full" />
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await logout();
    setMenuOpen(false);
    router.push("/");
  }, [logout, router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center no-underline focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
            aria-label="DiaryArchive home"
          >
            <svg viewBox="0 0 290 48" className="h-7 w-auto" aria-hidden="true">
              <text x="26" y="34" fontFamily="'Space Mono','Courier New',Courier,monospace" fontSize="32" fontWeight="700" textAnchor="start">
                <tspan fill="#A0A0A0">Diary</tspan><tspan fill="#A0845C">Archive</tspan>
              </text>
            </svg>
          </Link>
          <nav className="hidden md:flex items-center h-9">
            <NavLinks />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-sm text-muted hover:text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
                type="button"
              >
                {user?.username ?? "me"}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-1.5 min-w-36 border border-border bg-background shadow-sm"
                  role="menu"
                >
                  <Link
                    href="/me"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-overlay no-underline focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
                    role="menuitem"
                  >
                    My Diaries
                  </Link>
                  <Link
                    href="/me/bookmarks"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-overlay no-underline focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
                    role="menuitem"
                  >
                    Bookmarks
                  </Link>
                  <Link
                    href="/me/likes"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-overlay no-underline focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
                    role="menuitem"
                  >
                    Likes
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-overlay no-underline focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
                    role="menuitem"
                  >
                    Settings
                  </Link>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={handleLogout}
                    className="block w-full px-3 py-1.5 text-left text-xs text-destructive hover:bg-overlay cursor-pointer focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
                    type="button"
                    role="menuitem"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm px-3 py-1 rounded no-underline transition-colors focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
              style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}
            >
              Log In
            </Link>
          )}

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-muted hover:text-foreground cursor-pointer md:hidden focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2"
            aria-label="Toggle navigation menu"
            type="button"
          >
            {mobileOpen ? <XIcon className="inline-block" /> : <MenuIcon className="inline-block" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t-2 border-border px-4 py-3 md:hidden">
          <NavLinks vertical onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </header>
  );
}
