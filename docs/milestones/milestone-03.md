# Milestone 03 — Frontend Foundation

## Overview

**Goal:** The frontend has a working design system, theme toggling, layout components, and responsive structure. Pages render with placeholder content.

**Purpose:** Establish the visual and structural foundation for every subsequent frontend milestone. No user-facing functionality is built yet — only the shell that it will live inside.

**Dependencies:** Milestone 01 (Monorepo), Milestone 02 (Backend Foundation)

**Why this milestone exists:** Without layouts, theming, and a component library, every feature built later would need to invent its own structure. This milestone provides a consistent, accessible, responsive canvas that later milestones paint onto.

---

## Architecture Impact

### Backend
- No backend changes. This milestone is purely frontend.

### Frontend
- Tailwind CSS v4 with custom DiaryArchive design tokens defined as CSS custom properties.
- shadcn/ui component primitives customized to the brand palette.
- ThemeProvider for dark/light/system mode with localStorage persistence and flash-free hydration.
- Route group architecture: `(auth)/`, `(main)/`, `admin/` with dedicated layouts.
- NavBar with auth-aware states (anonymous vs authenticated), responsive mobile hamburger.
- Footer with branding, links, attribution.
- 404 and error boundary pages.

### Database
- No database changes.

### API
- No API changes.

### Search
- No search changes.

### Security
- CSP headers are configured server-side in Milestone 02. No additional frontend security concerns.

### Encryption
- No encryption concerns.

### Deployment
- Frontend Dockerfile already built in M1. This milestone adds the content that Dockerfile serves.

---

## Features

### F3.1 — Design Tokens & CSS Custom Properties

Define the full DiaryArchive design token system in `globals.css`.

**CSS Variables (Light Theme):**
- Background: `#faf8f5`, Surface: `#ffffff`, Subtle: `#f2eee9`, Border: `#e5e0db`
- Text-primary: `#1a1a1a`, Text-secondary: `#6b6560`, Text-tertiary: `#9e9892`
- Primary: `#b8735a` (warm terracotta), Primary-hover: `#a3624a`, Primary-light: `#f5e8e2`
- Secondary: `#8a9ba8` (muted blue-sage)
- Destructive: `#c44a4a`, Success: `#5a8f6a`, Warning: `#c49a4a`
- Focus-ring: `#b8735a`

**CSS Variables (Dark Theme):**
- Background: `#1c1816`, Surface: `#2a2522`, Border: `#443e3a`
- Text-primary: `#f0ece8`, Text-secondary: `#a09892`, Text-tertiary: `#6b6560`
- Primary: `#d4927a`, Primary-hover: `#e0a48c`, Primary-light: `#3d2d28`
- Shadows increase opacity for dark mode.

**Typography:**
- Font family variables: `--font-sans` (Inter), `--font-serif` (Georgia), `--font-mono` (JetBrains Mono)
- Inter loaded via `next/font/google` with `variable` font support
- Georgia is web-safe (no font load). JetBrains Mono is a CSS fallback chain.

**Design Tokens in `@theme` block:**
- Map CSS variables to Tailwind theme values using `@theme inline { --color-background: ... }`
- Radii: `--radius-sm` (0.25rem) through `--radius-xl` (1rem)
- Shadows: `--shadow-sm/md/lg`
- Transitions: `--transition-fast` (150ms), `--transition-normal` (200ms)

### F3.2 — ThemeProvider

Build a context-based theme system.

- File: `frontend/src/components/providers/theme-provider.tsx`
- Three modes: `"light"`, `"dark"`, `"system"`
- On mount: read `localStorage.getItem("diaryarchive-theme")`, fall back to `"system"`
- On system mode: listen to `prefers-color-scheme` media query, react to changes
- Apply resolved theme by adding `"light"` or `"dark"` class to `document.documentElement`
- Expose `theme`, `resolvedTheme`, `setTheme` via context hook `useTheme()`

**Flash prevention:**
- Inline `<script>` in `<head>` that reads localStorage and sets the class before first paint
- `suppressHydrationWarning` on `<html>` to avoid React mismatch

### F3.3 — RootLayout

- File: `frontend/src/app/layout.tsx`
- Load Inter font via `next/font/google` with `variable: "--font-sans"`
- Include flash-prevention script
- Set metadata: title "DiaryArchive", description "A place for your thoughts. Public or private."
- Wrap children in `<ThemeProvider>`
- Apply `min-h-screen bg-background font-sans antialiased` to `<body>`

### F3.4 — Route Group Layouts

**MainLayout** (used by homepage, explore, diary reader, profile, settings, notifications):
- `frontend/src/app/(main)/layout.tsx`
- Shell: `<NavBar />` + `<main>{children}</main>` + `<Footer />`
- Content area: `max-w-4xl`, centered, `px-4 md:px-8`, `py-8`
- Full-height flex column

**AuthLayout** (used by login, register):
- `frontend/src/app/(auth)/layout.tsx`
- Centered card layout: flexbox `items-center justify-center min-h-screen`
- Max card width: `max-w-md`

**EditorLayout** (used by diary editor):
- `frontend/src/components/layout/editor-layout.tsx`
- Minimal chrome: back button + logo in a thin top bar
- Full-width content area for the Tiptap editor

**AdminLayout** (used by admin dashboard):
- `frontend/src/components/layout/admin-layout.tsx`
- Fixed-width sidebar (w-56) with nav items: Overview, Reports, Users, Audit Logs, Health
- Top bar with "Admin Dashboard" header
- Content area fills remaining space, scrollable

### F3.5 — NavBar

**Anonymous state:**
- Left: Logo (BookOpen icon + "DiaryArchive"), Explore link, Random link
- Right: Theme toggle, Log in button, Register button

**Responsive behavior:**
- Desktop (`≥md`): horizontal nav links, buttons visible
- Mobile (`<md`): hamburger menu toggles a vertical panel with all links and buttons
- All touch targets minimum 44×44px

**States:**
- Default: transparent background with bottom border, subtle backdrop-blur
- The NavBar is pre-built to accommodate authenticated state (avatar dropdown slot, Write button slot) but those are wired in M04.

### F3.6 — Footer

- Simple footer with site name, tagline "A place for your thoughts. Public or private."
- Links: GitHub, Privacy, Terms
- Attribution: "Built with care"
- Responsive: stacks vertically on mobile, horizontal on desktop

### F3.7 — shadcn/ui Primitives

Create customized versions of essential shadcn/ui components:

| Component | File | Variants |
|-----------|------|----------|
| Button | `components/ui/button.tsx` | primary, secondary, ghost, destructive, link; sm/default/lg/icon |
| Card | `components/ui/card.tsx` | Header, Title, Description, Content, Footer |
| Input | `components/ui/input.tsx` | Standard single-line input with focus ring |
| Dialog | `components/ui/dialog.tsx` | Modal with overlay, header, footer, close button |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | Content, Item, Separator, Label, Group |
| Separator | `components/ui/separator.tsx` | horizontal/vertical |
| Skeleton | `components/ui/skeleton.tsx` | Animated pulse placeholder |

All styled with DiaryArchive CSS variables. No hardcoded colors.

### F3.8 — 404 & Error Pages

**Not Found (`frontend/src/app/not-found.tsx`):**
- Centered layout: large "404" in primary color, explanatory text, "Go home" button
- Uses Button component with Link

**Error Boundary (`frontend/src/app/error.tsx`):**
- Client component (uses `"use client"`)
- Displays "Something went wrong" with "Try again" button that calls `reset()`
- Production-friendly: no stack traces

### F3.9 — Homepage with Placeholder Content

- Welcome hero section with tagline
- "Latest Diaries" grid (3-column) with skeleton loading cards
- "Random Diary" card with skeleton content
- "Browse by Tags" flex-wrap cloud (life, reflection, poetry, travel, mental-health)
- "Browse by Emotion" bordered pills (happy, sad, hopeful, reflective, angry, anxious)
- "Browse by Year" year buttons (2026, 2025, 2024)
- All sections separated by `py-12` or `py-16`

---

## File Structure

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx              # AuthRouteLayout
│   │   ├── login/
│   │   │   └── page.tsx            # Login page placeholder
│   │   └── register/
│   │       └── page.tsx            # Register page placeholder
│   ├── (main)/
│   │   ├── layout.tsx              # MainRouteLayout → MainLayout
│   │   ├── page.tsx                # Homepage
│   │   └── explore/
│   │       └── page.tsx            # Explore placeholder
│   ├── admin/
│   │   ├── layout.tsx              # AdminRouteLayout → AdminLayout
│   │   └── page.tsx                # Admin placeholder
│   ├── layout.tsx                  # RootLayout (html, body, providers)
│   ├── page.tsx                    # [DELETED — moved to (main)/]
│   ├── not-found.tsx               # 404 page
│   ├── error.tsx                   # Error boundary
│   └── globals.css                 # Design tokens, Tailwind v4 config
├── components/
│   ├── layout/
│   │   ├── main-layout.tsx
│   │   ├── auth-layout.tsx
│   │   ├── editor-layout.tsx
│   │   ├── admin-layout.tsx
│   │   ├── navbar.tsx
│   │   └── footer.tsx
│   ├── providers/
│   │   └── theme-provider.tsx
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── separator.tsx
│       └── skeleton.tsx
├── hooks/                          # (empty, ready for custom hooks)
├── lib/
│   └── utils.ts                    # cn() utility
└── store/                          # (empty, ready for Zustand stores)
```

---

## Database Changes

None.

---

## API Endpoints

None.

---

## Frontend

### Routing Architecture

```
/                               → MainLayout → Homepage
/login                          → AuthLayout → Login
/register                       → AuthLayout → Register
/explore                        → MainLayout → Explore
/admin                          → AdminLayout → Admin Dashboard
/admin/*                        → AdminLayout → Admin sub-pages
```

### Accessibility

- All interactive elements have visible focus rings (`focus-visible:ring-2 focus-visible:ring-ring`)
- Skip-to-content link slot reserved (will be added in M14)
- Color contrast ratios verified: text-on-background 4.5:1 minimum in both themes
- Reduced motion query: disables all animations
- ARIA labels on icon-only buttons (theme toggle, hamburger menu)
- Semantic HTML: `<header>`, `<main>`, `<footer>`, `<nav>`
- Form labels are visible (no floating label pattern)

### Responsive Design

Breakpoints (Tailwind defaults):
- `sm` (≥640px): Large phones landscape
- `md` (≥768px): Tablets
- `lg` (≥1024px): Desktop
- `xl` (≥1280px): Wide desktop

Mobile adaptations:
- NavBar collapses to hamburger + logo
- Auth buttons move into hamburger panel
- Content padding: `px-4` mobile → `px-8` desktop
- Homepage grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Admin sidebar: hidden on mobile (future hamburger)

---

## Backend

No backend changes.

---

## Security

- No new security surface added. All pages are static shells.

---

## Performance

- Inter font loaded with `display: swap` to prevent FOIT
- Flash-prevention script is inline and tiny (<500 bytes)
- CSS variables are inherited cheaply — no recalculation overhead

---

## Testing

| Test | Type | Description |
|------|------|-------------|
| Theme toggle | Manual | Click theme icon, verify dark/light switch, verify persists on reload |
| System theme | Manual | Set OS to dark mode, verify site follows, change OS back |
| Mobile nav | Manual | Resize to <768px, verify hamburger menu works |
| 404 page | Manual | Visit `/nonexistent`, verify 404 renders with "Go home" |
| Layout routes | Manual | Visit `/login`, verify centered card; visit `/`, verify nav+footer |
| Color contrast | Manual/axe | Verify WCAG AA 4.5:1 ratio on text in both themes |

---

## Documentation

- `docs/frontend-design.md` — Reference for design decisions (already exists)
- `docs/milestones/milestone-03.md` — This document

---

## Acceptance Criteria

1. NavBar renders on all main-route pages with logo, links, theme toggle, and auth buttons.
2. Theme toggle switches between light and dark mode; choice persists across page reload.
3. System theme preference is detected on first visit; changes propagate live.
4. No flash of wrong theme on page load (verified by hard refresh).
5. Mobile viewport (<768px) shows hamburger menu; tapping expands navigation.
6. `/login` and `/register` render within a centered card with no nav chrome.
7. `/nonexistent` returns the custom 404 page with "Go home" button.
8. Any runtime error on a client page renders the error boundary with "Try again".
9. All shadcn/ui components render without errors (Button, Card, Input, Dialog, etc.).
10. Typography uses Inter for UI, Georgia for reading contexts (verified in inspector).
11. All interactive elements have visible focus indicators.
12. `prefers-reduced-motion: reduce` disables all animations and transitions.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Theme flash on load | Medium | Inline script in `<head>` before any React hydration |
| Tailwind v4 API instability | Low | Pin exact version in package.json; test on upgrade |
| Mobile nav accessibility | Low | Use semantic `<button>`, ARIA label, keyboard toggle |

---

## Future Considerations

- Milestone 04 wires authentication into the NavBar (avatar dropdown, Write button, notification bell).
- Milestone 14 adds skip-to-content link, full a11y audit, and page transitions.
- The `editor-layout.tsx` and `admin-layout.tsx` components are built here but their routes are populated in M07 and M12 respectively.
- Store directory is created empty; Zustand stores are added in M04 (auth-store) and M06 (diary-store).
