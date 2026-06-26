# DiaryArchive Frontend Design

> Status: Draft — v0.1
> Skills: diary-frontend, diary-ui-system
> Last updated: 2026-06-25

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [User Flows](#2-user-flows)
3. [Page Hierarchy & Sitemap](#3-page-hierarchy--sitemap)
4. [Navigation](#4-navigation)
5. [Layouts](#5-layouts)
6. [Typography](#6-typography)
7. [Spacing & Grid](#7-spacing--grid)
8. [Color System](#8-color-system)
9. [Design Tokens](#9-design-tokens)
10. [Component System](#10-component-system)
11. [Accessibility](#11-accessibility)
12. [Mobile Responsiveness](#12-mobile-responsiveness)
13. [Wireframe Descriptions](#13-wireframe-descriptions)
14. [States & Loading](#14-states--loading)

---

## 1. Design Philosophy

### Visual Inspiration

DiaryArchive's visual language draws from three sources:

| Influence | What We Take |
|-----------|--------------|
| Archive of Our Own | Typography-first layout, tag systems, community focus, functional minimalism |
| Early 2000s blogs (LiveJournal, Xanga) | Personal profiles, mood/emotion indicators, chronological diaries, "about me" sections, custom themes |
| Modern web UX | Responsive design, WCAG AA accessibility, dark mode, touch interactions, keyboard navigation |

### Design Principles

1. **Writing is the center of attention.** The editor and reader views are the most polished, most optimized surfaces. Navigation is secondary.

2. **Typography is the primary visual element.** We express personality through type, spacing, and layout — not through illustrations, gradients, or animations.

3. **Warmth without nostalgia.** The design feels personal and human without relying on skeuomorphic textures or expired trends. It should feel timeless, not retro.

4. **Calm over stimulation.** Low contrast, generous whitespace, muted colors, minimal motion. The interface should reduce anxiety.

5. **Consistent but not uniform.** Repeated patterns create familiarity. But profiles can feel personal (customizable themes in the future).

6. **Desktop-first with mobile as a first-class citizen.** Writing happens primarily on desktop, but reading and browsing happen everywhere.

### What We Avoid

- Glassmorphism, neumorphism, heavy shadows
- Gradient meshes and abstract illustrations
- Micro-animations that serve no purpose
- "For You" feeds and infinite scroll
- Gamification elements (streaks, badges, leaderboards)
- Notification dots that trigger anxiety
- Autoplay media

---

## 2. User Flows

### Flow A: First Visit (Anonymous)

```
Land on Homepage
  │
  ├─ Browse latest public diaries
  ├─ Read a random diary
  ├─ Explore by tags ──► Read diary
  ├─ Explore by emotions ──► Read diary
  ├─ Browse archive by year/month ──► Read diary
  │
  └─ Decide to join ──► Registration
```

Key emotion: Curiosity. The homepage should invite exploration without overwhelming. No sign-up wall, no "try premium" prompts.

### Flow B: Registration & First Diary

```
Register (username + password)
  │
  ├─ Optional: email (with warning about recovery)
  ├─ Optional: set up profile (about me, avatar)
  │
  └─ Create first diary
       │
       ├─ Write in Tiptap editor
       ├─ Add tags, emotion
       ├─ Choose privacy (public vs. private)
       └─ Publish or save as draft
```

Key emotion: Safety. The registration is minimal and honest. The privacy warning about no email recovery builds trust.

### Flow C: Returning User (Daily Use)

```
Login
  │
  ├─ Dashboard / My Diaries (last visited state)
  ├─ Check notifications (bell icon badge)
  ├─ Write a new entry
  ├─ Continue a draft
  └─ Browse explore / following feed
```

Key emotion: Ease. No friction to start writing. The last-edited diary or a "continue where you left off" prompt.

### Flow D: Social Interaction

```
Read a public diary
  │
  ├─ Like (heart icon)
  ├─ Bookmark (save for later)
  ├─ Comment (write, submit)
  ├─ Share (copy link)
  └─ Visit author's profile
       │
       ├─ Follow author
       ├─ Browse author's other diaries
       └─ View followers / following
```

Key emotion: Connection without pressure. Likes are not broadcast. Following is silent.

### Flow E: Privacy & Security

```
Settings
  │
  ├─ Change password
  ├─ Add/remove email
  ├─ Notification preferences
  └─ Export / Delete account
       │
       └─ Confirm deletion (type username, click delete)
```

Key emotion: Control. The user always knows what data is visible and can change it at any time.

---

## 3. Page Hierarchy & Sitemap

```
/                                   Homepage (public)
├── /login                          Login
├── /register                       Registration
│
├── /explore                        Explore public diaries
│   ├── ?tags=life,travel           Filtered by tag
│   ├── ?emotion=happy              Filtered by emotion
│   └── /2026/6                     Archive by year/month
│
├── /diary                          (redirect to /diary/new or /)
│   ├── /new                        Create diary
│   └── /[id]                       Read diary
│       └── /edit                   Edit diary
│
├── /profile/[username]             User public profile
│
├── /me                             Dashboard (my diaries)
│   ├── /me/likes                   My liked diaries
│   ├── /me/bookmarks               My bookmarked diaries
│   └── /me/drafts                  My drafts
│
├── /notifications                  Notification center
│
├── /settings                       Account settings
│   ├── /settings/profile           Profile info
│   ├── /settings/account           Password, email, delete
│   └── /settings/preferences       Theme, notifications
│
└── /admin                          Admin dashboard (if is_admin)
    ├── /admin/reports              Moderation queue
    ├── /admin/users                User management
    ├── /admin/audit-logs           Audit trail
    └── /admin/health               System health
```

### Page Groupings

| Group | Layout | Auth Required |
|-------|--------|---------------|
| Auth (`/login`, `/register`) | Centered card, minimal chrome | No (redirect if already authed) |
| Public (`/`, `/explore`, `/diary/[id]`, `/profile/*`) | Main layout | No |
| Authenticated (`/me/*`, `/diary/new`, `/settings`, `/notifications`) | Main layout | Yes |
| Editor (`/diary/new`, `/diary/[id]/edit`) | Editor layout (minimal chrome) | Yes |
| Admin (`/admin/*`) | Admin layout | Yes (is_admin) |

---

## 4. Navigation

### Primary Navigation (Top Bar)

Present on all pages except the editor.

```
┌─────────────────────────────────────────────────────────────┐
│  📖 DiaryArchive        Explore    Random    [Auth buttons] │
├─────────────────────────────────────────────────────────────┤
```

**Anonymous state (left → right):**
- Logo / site name (links to /)
- Explore (links to /explore)
- Random Diary (links to random diary)
- [empty space]
- Login button
- Register button (primary style)

**Authenticated state (left → right):**
- Logo / site name (links to / or /me)
- Explore
- Random Diary
- [empty space]
- Write button (prominent, links to /diary/new)
- Notification bell (with unread count badge)
- User avatar dropdown (My Diaries, Bookmarks, Likes, Settings, Logout)

**Admin state (additional):**
- Same as authenticated, plus admin link in user dropdown
- If admin layout: sidebar with admin nav items

### Secondary Navigation (Footer)

Simple footer with:
- Site name and tagline
- GitHub link (open source)
- Privacy / Terms links
- "Built with care" attribution

### Breadcrumbs

Used on deep pages:
```
Explore  ›  Tag: life  ›  A Walk in the Rain
```

### Navigation Principles

- No sticky navigation that blocks content while reading.
- The nav bar is visible but unobtrusive — thin, muted background, not high-contrast.
- On the diary reader page, the nav bar can auto-hide on scroll down and reappear on scroll up.
- The "Write" button is the most visually prominent action — it's the primary call to action.

---

## 5. Layouts

### Layout Hierarchy

```
RootLayout
├── Providers (Theme, QueryClient, Auth)
│   ├── AuthLayout
│   │   ├── /login
│   │   └── /register
│   │
│   ├── MainLayout
│   │   ├── / (homepage)
│   │   ├── /explore
│   │   ├── /diary/[id] (reader)
│   │   ├── /profile/[username]
│   │   ├── /me
│   │   ├── /notifications
│   │   └── /settings
│   │
│   ├── EditorLayout
│   │   ├── /diary/new
│   │   └── /diary/[id]/edit
│   │
│   └── AdminLayout
│       ├── /admin
│       ├── /admin/reports
│       ├── /admin/users
│       └── /admin/audit-logs
```

### Root Layout

```
┌──────────────────────────────────────┐
│  <html> + font preload + metadata    │
├──────────────────────────────────────┤
│  ThemeProvider (class: dark/light)   │
│  QueryClientProvider                 │
│  AuthProvider                        │
│  ┌────────────────────────────────┐  │
│  │  {children}                    │  │
│  └────────────────────────────────┘  │
│  Toaster (notifications)             │
└──────────────────────────────────────┘
```

### Auth Layout

```
┌──────────────────────────────────────┐
│  (muted background)                   │
│                                      │
│         ┌──────────────────┐         │
│         │                  │         │
│         │   Auth Card      │         │
│         │   (centered)     │         │
│         │                  │         │
│         └──────────────────┘         │
│                                      │
│  "If you lose your username..."      │
│  (warning text, small, below)        │
└──────────────────────────────────────┘
```

Centered vertically and horizontally. Max card width: 400px. No distractions.

### Main Layout

```
┌──────────────────────────────────────────────┐
│  NavBar                                       │
├──────────────────────────────────────────────┤
│                                              │
│          Main Content (max-w-4xl, centered)   │
│          padding: px-4 md:px-8               │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  │  {children}                            │  │
│  │  (scrollable)                          │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
├──────────────────────────────────────────────┤
│  Footer                                       │
└──────────────────────────────────────────────┘
```

Single column, centered. Content area max-width: 72rem (1152px) for general pages, narrower for reading views.

### Editor Layout

```
┌──────────────────────────────────────────────┐
│  EditorNavBar (minimal: back, title, publish) │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │                                        │  │
│  │  Tiptap Editor (full-width)            │  │
│  │  padding: generous horizontal          │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
├──────────────────────────────────────────────┤
│  EditorFooter (word count, autosave status)   │
└──────────────────────────────────────────────┘
```

Minimal chrome. The editor is the full viewport. The toolbar is a floating bar or top bar that appears on focus.

### Admin Layout

```
┌──────────────────────────────────────────────┐
│  TopBar (admin badge, user menu)              │
├──────────────┬───────────────────────────────┤
│  Sidebar     │  Main Content                  │
│  (collapsed: │                                │
│   icons only │  {children}                    │
│   expanded:  │                                │
│   icons+text)│                                │
│              │                                │
│  Reports     │                                │
│  Users       │                                │
│  Audit Logs  │                                │
│  Health      │                                │
└──────────────┴───────────────────────────────┘
```

Desktop: sidebar visible, expanded by default. Mobile: sidebar hidden behind hamburger menu.

---

## 6. Typography

### Typeface Selection

| Role | Typeface | Fallback | Weight | Why |
|------|----------|----------|--------|-----|
| UI text | **Inter** | system-ui, sans-serif | 400, 500, 600, 700 | Highly readable at small sizes, excellent spacing, variable font |
| Diary content (reading) | **Georgia** | Palatino, "Palatino Linotype", serif | 400, 700 | Web-safe serif with character, excellent readability, no extra font load |
| Diary headings (reading) | **Georgia** | serif | 700 | Same font as body, bold weight for hierarchy |
| Editor content | **Georgia** | serif | 400 | Consistency between write and read |
| Code blocks | **JetBrains Mono** | "Fira Code", monospace | 400 | Developer-friendly, ligatures optional |

### Why Georgia over a Custom Web Font?

- Zero font load cost (system font on nearly every device).
- Excellent readability at body sizes.
- Warm, human character that fits the diary aesthetic.
- If we later want a custom serif, we can swap it without changing the design.

### Font Sizes (Tailwind Scale)

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 0.75rem (12px) | 1.5 | Metadata, timestamps, badges |
| `text-sm` | 0.875rem (14px) | 1.5 | Secondary UI text, nav links |
| `text-base` | 1rem (16px) | 1.6 | Body text, diary content, form labels |
| `text-lg` | 1.125rem (18px) | 1.6 | Large body text, intro paragraphs |
| `text-xl` | 1.25rem (20px) | 1.4 | Section headings, diary card titles |
| `text-2xl` | 1.5rem (24px) | 1.3 | Page headings, diary title |
| `text-3xl` | 1.875rem (30px) | 1.2 | Hero headings, homepage section titles |
| `text-4xl` | 2.25rem (36px) | 1.1 | Main headline (rarely used) |

### Type Scale on Mobile

Mobile reduces headings by one step:
- `text-xl` → `text-lg`
- `text-2xl` → `text-xl`
- `text-3xl` → `text-2xl`
- `text-4xl` → `text-3xl`

### Line Length (Measure)

- **Reading content (diary body):** 65-75 characters per line. Achieved via `max-w-prose` (65ch) or custom `max-w-[68ch]`.
- **UI content:** 80-90 characters per line. Wider to utilize space efficiently.
- **Lists and cards:** No constraint — cards have their own internal padding.

### Letter Spacing

- Body: normal (0em)
- Headings: slightly tighter (-0.01em to -0.02em) for headings above `text-2xl`
- UI labels: slight tracking for uppercase text (0.05em)
- Never use tracking for body text.

---

## 7. Spacing & Grid

### Spacing Scale (Tailwind)

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 0.25rem (4px) | Icon gaps, inline elements |
| `space-2` | 0.5rem (8px) | Small element gaps, button padding |
| `space-3` | 0.75rem (12px) | Element insets, card padding (compact) |
| `space-4` | 1rem (16px) | Standard padding inside cards, form fields |
| `space-6` | 1.5rem (24px) | Section gaps, card padding (default) |
| `space-8` | 2rem (32px) | Between major sections |
| `space-10` | 2.5rem (40px) | Content section separation |
| `space-12` | 3rem (48px) | Page section separation |
| `space-16` | 4rem (64px) | Between major page sections |
| `space-20` | 5rem (80px) | Top/bottom of main content areas |

### Vertical Rhythm

- Body text paragraphs: `mb-4` (16px gap).
- Headings: `mt-8 mb-4` (more space above than below).
- Lists: `space-y-2` (8px between items).
- Form fields: `space-y-6` (24px between fields).

### Grid

- **Homepage sections:** CSS Grid, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, gap `space-4`.
- **Diary list (profile):** `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, gap `space-4`.
- **Admin dashboard:** CSS Grid for stat cards: `grid-cols-2 md:grid-cols-4`, gap `space-4`.
- **Editor:** Single column, full-width.

### Page Margins

- **Desktop (≥1024px):** `px-8` (32px) plus `max-w-4xl` (centered).
- **Tablet (768-1023px):** `px-6`.
- **Mobile (<768px):** `px-4`.

---

## 8. Color System

### Palette Philosophy

Warm, muted, human. No pure grays — every neutral has a warm undertone.

### Light Theme

```
Background          #faf8f5    warm off-white
Surface             #ffffff    card backgrounds
Subtle              #f2eee9    hover states, subtle backgrounds
Border              #e5e0db    dividers, outlines
Border-light        #f0ebe6    lighter borders (disabled states)

Text-primary        #1a1a1a    headings, body
Text-secondary      #6b6560    muted text, metadata
Text-tertiary       #9e9892    placeholders, disabled

Primary             #b8735a    accent (warm terracotta)
Primary-hover       #a3624a    darker hover
Primary-light       #f5e8e2    background tint
Primary-foreground  #ffffff    text on primary

Secondary           #8a9ba8    muted blue-sage
Secondary-hover     #748592

Destructive         #c44a4a    errors, destructive actions
Destructive-light   #fce8e8

Success             #5a8f6a    positive actions
Success-light       #e8f5ec

Warning             #c49a4a    caution
Warning-light       #f5f0e0

Focus-ring          #b8735a    outline on focus (accessibility)
```

### Dark Theme

```
Background          #1c1816    warm dark
Surface             #2a2522    card backgrounds
Subtle              #35302c    hover states
Border              #443e3a    dividers
Border-light        #35302c

Text-primary        #f0ece8    headings, body
Text-secondary      #a09892    muted text
Text-tertiary       #6b6560    placeholders

Primary             #d4927a    bright warm terracotta
Primary-hover       #e0a48c
Primary-light       #3d2d28    background tint
Primary-foreground  #1c1816

Secondary           #8a9ba8    same as light (adjusted contrast)
Secondary-hover     #9eafbc

Destructive         #e86060
Destructive-light   #3d2020

Success             #6fb87f
Success-light       #1e3324

Warning             #d4b060
Warning-light       #3d3520

Focus-ring          #d4927a
```

### Theme Application

- Theme is controlled by a `class` on the `<html>` element: `class="light"` or `class="dark"`.
- Tailwind's `darkMode: 'class'` handles the switching.
- System preference detected on first visit via `prefers-color-scheme`.
- User can override in settings.
- No flash of wrong theme — script in `<head>` checks stored preference before render.

### Usage Guidelines

| Element | Light | Dark |
|---------|-------|------|
| Page background | `#faf8f5` | `#1c1816` |
| Card background | `#ffffff` | `#2a2522` |
| Nav bar background | `#ffffff` with subtle bottom border | `#2a2522` with subtle border |
| Input background | `#ffffff` | `#2a2522` |
| Input border | `#e5e0db` | `#443e3a` |
| Primary button bg | `#b8735a` | `#d4927a` |
| Primary button text | `#ffffff` | `#1c1816` |
| Link color | `#b8735a` | `#d4927a` |
| Link hover | `#a3624a` | `#e0a48c` |

---

## 9. Design Tokens

Tokens are defined as CSS custom properties on `:root` and `.dark`.

```css
:root {
  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-serif: Georgia, Palatino, 'Palatino Linotype', serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Spacing (reuses Tailwind scale) */

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Shadows (minimal — flat design preferred) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.06);
  --shadow-lg: 0 4px 16px rgba(0,0,0,0.08);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;

  /* Z-index scale */
  --z-base: 1;
  --z-dropdown: 50;
  --z-modal: 100;
  --z-toast: 150;
}

.dark {
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.3);
  --shadow-lg: 0 4px 16px rgba(0,0,0,0.4);
}
```

### shadcn/ui Integration

All shadcn/ui tokens are set via CSS variables, following their theming convention. The custom palette maps to:

```css
:root {
  --background: 30 20% 97%;      /* #faf8f5 */
  --foreground: 0 0% 10%;         /* #1a1a1a */
  --card: 0 0% 100%;              /* #ffffff */
  --card-foreground: 0 0% 10%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 10%;
  --primary: 15 40% 54%;          /* #b8735a */
  --primary-foreground: 0 0% 100%;
  --secondary: 210 15% 60%;       /* #8a9ba8 */
  --secondary-foreground: 0 0% 100%;
  --muted: 30 10% 92%;            /* #f2eee9 */
  --muted-foreground: 25 5% 40%;  /* #6b6560 */
  --accent: 15 40% 54%;           /* same as primary for now */
  --accent-foreground: 0 0% 100%;
  --destructive: 0 52% 53%;       /* #c44a4a */
  --destructive-foreground: 0 0% 100%;
  --border: 30 10% 85%;           /* #e5e0db */
  --input: 30 10% 85%;
  --ring: 15 40% 54%;             /* focus ring */
  --radius: 0.5rem;
}
```

---

## 10. Component System

### shadcn/ui Primitives

We use shadcn/ui as the base, customized with the DiaryArchive design tokens. The following primitives are available:

| Component | Customizations |
|-----------|----------------|
| Button | 4 variants: primary (filled terracotta), secondary (outlined), ghost (subtle), destructive. Sizes: sm, default, lg, icon. |
| Card | No shadow by default. Subtle border. Optional hover: border becomes slightly darker. |
| Dialog | Centered modal with backdrop blur. Minimal chrome — no title bar if not needed. |
| Dropdown Menu | For user menu, overflow menus. Compact, minimal borders. |
| Popover | For tooltips, small overlays. |
| Select | Native-like select with styled trigger. |
| Input | Minimal border, focus ring on primary color. |
| Textarea | Same as input, resizable vertically only. |
| Switch | For settings toggles. Primary color when on. |
| Tabs | Underline style (material-like). Active tab has primary color underline. |
| Badge | For tags, emotions. Subtle background, muted text. |
| Avatar | Circular, with fallback initials. Optional badge for online status. |
| Separator | Thin line. `#e5e0db` in light, `#443e3a` in dark. |
| Skeleton | For loading states. Subtle shimmer. |
| Toast | For notifications (e.g., "Diary saved"). Auto-dismiss. |
| Progress | For loading bars. |

### Custom Components

#### DiaryCard
The core content unit across the entire site.

```
┌──────────────────────────────────┐
│ [EmotionBadge]  [tags...]        │
│                                  │
│ Title (max 2 lines, truncated)   │
│                                  │
│ Excerpt (max 3 lines, truncated) │
│                                  │
│ Author avatar + name   ♥ 3  💬 5 │
│ 2 hours ago                     │
└──────────────────────────────────┘
```

**States:** default, hover (subtle border darkening), loading (skeleton).

**Variants:** compact (for profile grid), detailed (for homepage feature).

#### DiaryReader (Full Article View)

```
┌──────────────────────────────────────┐
│   ← Back to explore                  │
│                                      │
│   Author avatar  moonwriter          │
│   Jun 25, 2026  ·  ☁️ hopeful        │
│                                      │
│   # A Walk in the Rain               │
│                                      │
│   (Georgia, 1.6 line height,         │
│    max-w-prose centered)             │
│                                      │
│   Today I walked in the rain and     │
│   felt alive. The streets were       │
│   quiet, the world softened by       │
│   water...                           │
│                                      │
│   ────────────────────────           │
│                                      │
│   Tags: life  weather  reflection    │
│                                      │
│   ♥ 12  🔖 5  💬 3                  │
│                                      │
│   ──────────── Comments ─────────    │
│                                      │
│   starreader — 1 hour ago            │
│   This really resonates with me...   │
│                                      │
│   [Write a comment...]   [Post]      │
└──────────────────────────────────────┘
```

#### Editor

```
┌──────────────────────────────────────┐
│ ← Back                     Draft saved│
│                                      │
│ [Title: placeholder — "What's on     │
│  your mind?"]                        │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ B  I  U  S  H1  H2  •  1.  ☑  │ │ ← toolbar (appears on focus)
│ │ ┌──────────────────────────────┐ │ │
│ │ │                              │ │ │
│ │ │ Tiptap content area          │ │ │
│ │ │ (Georgia, 1.6 line height)   │ │ │
│ │ │                              │ │ │
│ │ └──────────────────────────────┘ │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Privacy: Public ▼                │ │
│ │ Tags: [life, weather, ...]       │ │
│ │ Emotion: [hopeful ▼]             │ │
│ │ Comments: On                     │ │
│ │                                  │ │
│ │ [Save Draft]  [Publish]          │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

#### ProfilePage

```
┌──────────────────────────────────────────────┐
│                                              │
│     [Avatar]                                 │
│     @moonwriter                              │
│     "writing my thoughts"                     │
│     ☁️ feeling hopeful                        │
│                                              │
│     📝 24 diaries   👥 12 followers  8 following│
│                                              │
│  ┌────┬──────────┬───────────┬────────────┐  │
│  │About│ Diaries │ Followers │ Following   │  │
│  ├────┴──────────┴───────────┴────────────┤  │
│  │                                         │  │
│  │  DiaryCard  DiaryCard  DiaryCard        │  │
│  │  DiaryCard  DiaryCard  DiaryCard        │  │
│  │                                         │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

#### NotificationItem

```
┌──────────────────────────────────────────┐
│ ● [Heart icon] starreader liked your      │
│   diary "A Walk in the Rain"              │
│   2 hours ago                             │
├──────────────────────────────────────────┤
│ ○ [Comment icon] skywatcher commented     │
│   on your diary "Sunset Thoughts"         │
│   1 day ago                               │
└──────────────────────────────────────────┘
```

Unread: `●` (filled dot) + slightly bolder background. Read: `○` (empty dot) + normal background.

### Button System

| Variant | Light | Dark | Usage |
|---------|-------|------|-------|
| `primary` | `#b8735a` bg, white text | `#d4927a` bg, dark text | Main actions: Publish, Save, Post Comment, Register |
| `secondary` | Transparent, `#6b6560` border, `#1a1a1a` text | Same approach with dark colors | Secondary actions: Save Draft, Cancel |
| `ghost` | Transparent, `#6b6560` text on hover | Same | Tertiary actions, icon buttons |
| `destructive` | `#c44a4a` bg, white text | `#e86060` bg, dark text | Delete, Ban, destructive confirms |
| `link` | `#b8735a` text, underline on hover | `#d4927a` | Inline actions, "view all" |

---

## 11. Accessibility

### WCAG AA Targets

All interactive elements and content must meet WCAG 2.1 AA at minimum.

### Color & Contrast

- Text on background: minimum 4.5:1 contrast ratio (AA normal text).
- Large text (≥18px bold or ≥24px): minimum 3:1 contrast ratio.
- All interactive element borders/states: 3:1 minimum against adjacent colors.
- Focus indicators: 3:1 against the element background.

### Focus Management

- All interactive elements have a visible focus ring (`outline: 2px solid var(--ring)` with `outline-offset: 2px`).
- Modals trap focus (Tab cycles within the modal).
- Route changes reset focus to the page heading.
- Skip-to-content link at the top of every page.

### Keyboard Navigation

- All functionality available via keyboard.
- Tab order follows visual order (no positive `tabindex` values).
- Custom interactive elements (dropdowns, selects, modals) use proper ARIA roles.
- Arrow key navigation within option groups (tag selector, emotion picker).

### Screen Reader Support

- Semantic HTML structure (`<nav>`, `<main>`, `<article>`, `<aside>`, `<section>`).
- ARIA labels on icon-only buttons (e.g., "Like this diary", "Bookmark this diary").
- Live regions for dynamic content (toast notifications, autosave status).
- Descriptive alt text on user-uploaded images (when provided).
- Hidden headings for section identification when visual design doesn't include them.

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

No auto-playing animations, no parallax, no particle effects.

### Forms

- Labels are always visible (no floating label pattern — reduces cognitive load).
- Error messages are associated with inputs via `aria-describedby`.
- Required fields are marked with `aria-required="true"`.
- Submit buttons show loading state and disable during submission.

---

## 12. Mobile Responsiveness

### Breakpoints (Tailwind)

| Breakpoint | Width | Target |
|------------|-------|--------|
| `sm` | ≥640px | Large phones (landscape) |
| `md` | ≥768px | Tablets |
| `lg` | ≥1024px | Desktop |
| `xl` | ≥1280px | Wide desktop |

### Mobile Adaptations

**Navigation:**
- Nav bar collapses to: logo + hamburger menu.
- "Write" becomes a floating action button (bottom-right).
- Notification bell and avatar move into the hamburger menu.

**Main content:**
- Single column at all sizes (our base layout is already single-column).
- Padding reduces from `px-8` (desktop) to `px-4` (mobile).
- Diary cards go from 3-4 columns to single column.

**Editor:**
- Toolbar collapses to show only the most-used buttons (B, I, headings).
- Additional tools in an overflow "..." menu.
- Settings panel (tags, emotion, privacy) becomes a bottom sheet instead of sidebar.

**Reader:**
- Full-width reading (no `max-w-prose` constraint on very small screens — use padding instead).
- Comments section at full width.

**Admin:**
- Sidebar becomes a bottom navigation bar (5 tabs) or hamburger menu.
- Stat cards: `grid-cols-2` on mobile (was `grid-cols-4`).

### Touch Targets

- Minimum 44×44px for all touch targets.
- Buttons have adequate padding — no text-only links as primary actions on mobile.
- Swipe gestures: swipe right on a notification to mark as read (future enhancement).

### Mobile-Specific Features

- Pull-to-refresh on diary lists.
- Haptic feedback on like (short vibration).
- Share sheet integration (native `navigator.share()` for diary links).

---

## 13. Wireframe Descriptions

### 13.1 Homepage (Anonymous)

```
Layout: MainLayout (with NavBar showing Login/Register)

The page scrolls vertically. Sections are separated by generous whitespace (py-16).

── Section 1: Hero ──────────────────────────
A simple heading: "Welcome to DiaryArchive"
Subheading: "A place for your thoughts. Public or private."
No hero image, no illustration. Just typography.

── Section 2: Latest Public Diaries ─────────
Heading: "Latest Diaries"
3-column grid of DiaryCards.
Each card shows: emotion badge (emoji), title, excerpt (3 lines), author, timestamp, like/comment counts.
"View all" link at bottom-right.

── Section 3: Random Diary ──────────────────
Heading: "Random Diary"
A single, larger DiaryCard that changes on page reload.
"Shuffle" button to get another random diary without page reload.

── Section 4: Browse by Tags ────────────────
Heading: "Browse by Tags"
A tag cloud: clickable tag badges in a flex-wrap layout.
Tags sized by popularity (more popular = slightly larger text).
Each tag links to /explore?tags=tagname.

── Section 5: Browse by Emotions ────────────
Heading: "Browse by Emotion"
Row of emotion buttons with emojis and labels:
😊 Happy  😢 Sad  😌 Hopeful  🤔 Reflective  😤 Angry  😰 Anxious
Each links to /explore?emotion=emotionname.

── Section 6: Archive by Year ───────────────
Heading: "Browse by Year"
Row of year buttons: 2024, 2025, 2026, ...
Each links to /explore?year=YYYY.
If year has months with entries, show month buttons below the selected year.
```

### 13.2 Homepage (Authenticated)

```
Same as anonymous, but:

- NavBar shows "Write" button, notification bell, avatar.
- Optional: a "Continue Writing" section at the top showing the 3 most recent drafts.
- Optional: a "From People You Follow" section above Latest Diaries (only if the user follows people).
```

### 13.3 Explore Page

```
Layout: MainLayout

── Filter Bar ───────────────────────────────
A horizontal scrollable filter bar below the nav:

[All] [Life] [Mental Health] [Poetry] ... (tag pills, horizontally scrollable on mobile)

Below tags: emotion and date filters as dropdowns or secondary pills.

── Search Bar ───────────────────────────────
A text input with search icon: "Search diaries..."
Results update as user types (debounced 300ms).

── Results Grid ─────────────────────────────
3-column grid of DiaryCards.
Empty state: "No diaries found. Try different filters."
"Load More" button at bottom (no infinite scroll).
```

### 13.4 Diary Reader

```
Layout: MainLayout (nav auto-hides on scroll down)

── Header ───────────────────────────────────
Breadcrumb: Explore > Tag: life > Diary title
Author info: avatar, username, timestamp, emotion badge
Action buttons: ♥ Like (filled if liked), 🔖 Bookmark, 🔗 Share

── Content ──────────────────────────────────
Diary title as H1 (Georgia, bold)
Body content (Georgia, 1.6 line height, max-w-prose centered)
Images are max-width 100%, rounded corners, with optional caption.

── Footer ───────────────────────────────────
Tags as clickable badges
Stats: X likes, Y bookmarks, Z comments
If owner: [Edit] [Delete] buttons

── Comments Section ─────────────────────────
Heading: "Comments" with count
Each comment: avatar, username, timestamp, content, [Delete] (if owner)
Comment input: textarea + "Post" button
If comments disabled: "Comments are disabled on this diary."
If comments locked: "Comments are closed."
```

### 13.5 Diary Editor

```
Layout: EditorLayout (minimal)

── Top Bar ──────────────────────────────────
← Back arrow (confirms if unsaved changes)
DiaryArchive logo (small)
Autosave indicator: "Saving..." / "Saved" / "Draft saved at 3:45 PM"

── Title Input ──────────────────────────────
Large input (text-2xl, Georgia): "What's on your mind?"
No label — the placeholder is the label.
On mobile: smaller font size.

── Tiptap Editor ────────────────────────────
Full-width content area.
Georgia font, 1.6 line height.
Empty state: subtle placeholder text — "Write freely. This is your space."

── Floating Toolbar ─────────────────────────
Appears when text is selected or cursor is in editor.
Pills: Bold, Italic, Heading, List, Quote, Code, Image
Mobile: collapsible into "..." menu.

── Settings Panel (below editor or sidebar) ─
Privacy selector: Public / Private / Draft
    (with brief explanation of each)

Tags input: type to add, comma to separate. Existing tags shown as removable badges.
Emotion selector: dropdown of predefined emotions.
Comments toggle: Enable / Disable.

── Bottom Bar ───────────────────────────────
Word count | Character count | Reading time estimate
[Save Draft] button | [Publish] button (primary, prominent)
```

### 13.6 User Profile

```
Layout: MainLayout

── Profile Header ──────────────────────────
Large avatar (96px on desktop, 64px on mobile)
Username (heading)
"About me" bio text
"Currently feeling" emotion badge
Stats row: X diaries · Y followers · Z following
[Follow] / [Unfollow] button (if viewing another user)
[Edit Profile] button (if viewing own profile)

── Tabs ─────────────────────────────────────
About | Diaries | Followers | Following

── About Tab ───────────────────────────────
Full bio, favorite quote, join date, favorite tags.

── Diaries Tab ─────────────────────────────
3-column grid of DiaryCards.
Paginated with "Load More."

── Followers / Following Tabs ──────────────
List of user cards (avatar + username + follow button).
Paginated.
```

### 13.7 Notifications

```
Layout: MainLayout

── Header ──────────────────────────────────
Heading: "Notifications"
"Mark all as read" button (appears if there are unread notifications)

── List ────────────────────────────────────
Grouped by date: "Today", "Yesterday", "This Week", "Earlier"
Each item: icon (heart for like, comment bubble, person for follow), message, relative timestamp.
Unread items have a subtle tinted background (--primary-light) and a blue dot.
Clicking a notification navigates to the relevant diary/profile.
"Load More" at bottom.
Empty state: "No notifications yet. Interact with the community to see activity here."
```

### 13.8 Settings

```
Layout: MainLayout

── Sidebar (desktop) or Tabs (mobile) ──────
Profile | Account | Preferences

── Profile Tab ─────────────────────────────
Avatar upload (with preview)
About me (textarea)
Favorite quote (input)
Currently feeling (select or input)

── Account Tab ─────────────────────────────
Username (display only, cannot change)
Email (add/change/remove with verification)
Change password (current + new + confirm)
Danger zone: Export data, Delete account (with confirmation dialog)

── Preferences Tab ─────────────────────────
Theme: System / Light / Dark
Notifications: toggles for each type (like, comment, follow, bookmark)
Email notifications: toggle (requires email)
Privacy: Default comment setting for new diaries
```

### 13.9 Admin Dashboard

```
Layout: AdminLayout

── Stats Cards Row ──────────────────────────
4 cards in a row: Total Users, Public Diaries, Pending Reports, Storage Used
Each card shows: icon, label, value, and optional trend indicator.

── Main Content ────────────────────────────
Below stats: two-column layout.

Left column (wider):
- Recent Reports (table: date, reporter, target, reason, status, actions)
- "View All" link to /admin/reports

Right column:
- Recent Registrations (user list with join dates)
- System Health (green/yellow/red status dots for each service)
```

---

## 14. States & Loading

### Loading States

| State | Implementation |
|-------|----------------|
| **Page load** | Skeleton screens matching the page layout shape. Not a spinner. |
| **Infinite query** | Skeleton cards at the bottom of the grid. |
| **Action loading** | Button shows spinner + "Saving..." text. Button is disabled during the action. |
| **Image loading** | Low-quality placeholder or subtle shimmer while image loads. |
| **Search** | Debounced 300ms. Show spinner in the search input. Results update in-place. |

### Empty States

| Page | Empty State Message |
|------|---------------------|
| Diary list (user) | "No diaries yet. The blank page is waiting." + [Write your first diary] |
| Explore (no results) | "No diaries match your filters. Try different tags or browse the latest." |
| Following feed | "When you follow people, their public diaries will appear here." + [Explore diaries] |
| Notifications | "No notifications yet. Your silence is golden." |
| Likes / Bookmarks | "Nothing saved yet. Explore diaries and save the ones you love." |
| Search (no results) | "No diaries found for '{query}'. Try different words or browse by tags." |
| Comments | "No comments yet. Be the first to share your thoughts." |

### Error States

| Error | Implementation |
|-------|----------------|
| **Network error** | Inline message within the content area: "Couldn't load diaries. [Try again]" |
| **404** | Full page: "This page doesn't exist." + [Go home] button |
| **403** | "You don't have permission to view this." |
| **429** | "Too many requests. Please wait a moment and try again." |
| **500** | "Something went wrong. We've been notified." + [Try again] |
| **Form error** | Inline error message below the specific field. Red border on the field. |

---

> **Next Steps:**
> 1. Review this frontend design document.
> 2. Once approved, implementation begins with the theme system, layout components, and the homepage.
> 3. The editor and reader views are the highest priority for polish.
