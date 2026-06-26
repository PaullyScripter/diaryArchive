# Milestone 07 — Rich Text Editor

## Overview

**Goal:** The Tiptap editor is fully integrated with formatting, autosave, drafts, and media uploads. Users write diaries in a professional rich text environment with real-time saving and draft recovery.

**Purpose:** Diary writing is the core action of the application. M06 provided a basic plain-text form, but diary authors expect rich formatting (bold, italic, headings, lists, code blocks), automatic saving, and draft recovery. This milestone transforms the writing experience from functional to delightful.

**Dependencies:** Milestone 06 (Public Diaries), Milestone 03 (Frontend Foundation)

---

## Architecture Impact

### Backend
- Draft endpoint support: diaries with `privacy: "draft"` behave as drafts
- Autosave endpoint reuses PUT /diaries/{id} with draft support
- Drafts excluded from all public queries, only visible to owner
- No separate drafts collection — drafts are diaries with privacy="draft"
- Periodic cleanup of stale drafts (optional, background worker)

### Frontend
- Tiptap editor replaces the plain-textarea in diary create/edit flows
- Toolbar (fixed) + Floating toolbar (on selection) + Bottom bar (word/char count, save status)
- Autosave engine with 30-second debounce, unsaved changes warning
- Draft system: `draft_id` stored in localStorage, recovered on revisit
- Settings panel as a collapsible sidebar in the editor layout
- Tags autocomplete with debounced API calls
- Undo/redo via Tiptap built-in history extension

### Database
- `diaries` collection already supports `privacy: "draft"` from M06
- No new collections. Auto-save creates or updates a draft diary entry.
- Stale draft cleanup via TTL index on `updated_at` for draft-only diaries (e.g., 7 days)

### API
- No new endpoints (reuses M06 diary CRUD)
- Draft-specific behavior: privacy filter, visibility rules adjusted

### Security
- Server-side HTML sanitization (same as M06) applies to all drafts and published content
- Drafts excluded from all public queries at the database query level
- Owner-only access enforced by `get_current_user` + user_id match
- Tags autocomplete endpoint is public but limited (returns only tag names, no counts)

---

## Features

### F7.1 — Tiptap Editor Integration (Frontend)

**File:** `frontend/src/components/editor/tiptap-editor.tsx`

Core editor component wrapping Tiptap:

```tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import { useCallback, useEffect } from 'react';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  editable?: boolean;
  id?: string; // for SSR hydration
}
```

Setup:
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-placeholder`, `@tiptap/extension-typography`, `@tiptap/extension-link`
- StarterKit includes: bold, italic, strike, code, heading, blockquote, bulletList, orderedList, codeBlock, history
- Underline is NOT in StarterKit (separate extension)
- Typography extension for smart quotes, em dashes, ellipsis
- Placeholder text: "What's on your mind?"

### F7.2 — Editor Toolbar (Frontend)

**File:** `frontend/src/components/editor/editor-toolbar.tsx`

Fixed toolbar at the top of the editor:

```
┌─────────────────────────────────────────────┐
│ [B] [I] [U] [S] | [H1] [H2] [H3] | [Quote] │
│ [Code] [UL] [OL] [CL] | [Undo] [Redo]       │
└─────────────────────────────────────────────┘
```

- Bold (B), Italic (I), Underline (U), Strikethrough (S)
- Headings: H1, H2, H3
- Blockquote, Code Block
- Bullet List (UL), Ordered List (OL), Check List (CL)
- Undo/Redo buttons
- Active state: button highlighted when formatting is active (e.g., Bold button lit when cursor is in bold text)
- Tooltip on hover for each button (shows keyboard shortcut)
- Responsive: wraps to two rows on narrow screens, collapses into "..." overflow menu if needed

### F7.3 — Floating Toolbar (Frontend)

**File:** `frontend/src/components/editor/floating-toolbar.tsx`

Appears when user selects text, positioned above the selection:

```
┌──────────────────────┐
│ [B] [I] [U] [S] [H2] │
└──────────────────────┘
```

- Uses `@tiptap/extension-floating-menu` or custom bubble menu
- Appears on text selection, disappears on blur
- Position calculated relative to selection bounding rect
- Minimal subset: Bold, Italic, Underline, Strikethrough, H2
- Animated entrance (fade + slight upward slide, 150ms)
- Dismisses on Escape key

### F7.4 — Markdown Shortcuts (Frontend)

Configured via Tiptap extensions; no custom code needed for most:

| Shortcut | Result |
|----------|--------|
| `# ` at line start | H1 |
| `## ` at line start | H2 |
| `### ` at line start | H3 |
| `**text**` | Bold |
| `*text*` | Italic |
| `~~text~~` | Strikethrough |
| `> ` at line start | Blockquote |
| `- ` at line start | Bullet list |
| `1. ` at line start | Ordered list |
| `[] ` at line start | Check list |
| `` `code` `` inline | Inline code |
| ` ``` ` at line start | Code block |

Tiptap's built-in markdown shortcuts handle these; `@tiptap/extension-typography` adds smart quotes, em dashes (`--` → `—`), ellipsis (`...` → `…`).

### F7.5 — Keyboard Shortcuts (Frontend)

Provided by Tiptap StarterKit + custom mappings:

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Ctrl+Shift+S` | Strikethrough |
| `Ctrl+Shift+1` | H1 |
| `Ctrl+Shift+2` | H2 |
| `Ctrl+Shift+3` | H3 |
| `Ctrl+Shift+7` | Ordered list |
| `Ctrl+Shift+8` | Bullet list |
| `Ctrl+Shift+9` | Check list |
| `Ctrl+Shift+B` | Blockquote |
| `Ctrl+Shift+C` | Code block |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+S` | Save (trigger autosave immediately) |

### F7.6 — Autosave Engine (Frontend)

**File:** `frontend/src/hooks/use-autosave.ts`

```typescript
interface UseAutosaveOptions {
  diaryId?: string; // null for new diary
  title: string;
  contentHtml: string;
  privacy: Privacy;
  isDraft: boolean;
  onSaved?: (id: string) => void;
}

interface UseAutosaveReturn {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
  saveNow: () => Promise<void>;
}
```

Logic:
1. Watch `title`, `contentHtml` for changes (deep compare previous snapshot)
2. On change, start 30-second debounce timer
3. On timer fire: call POST /diaries (if new) or PUT /diaries/{id} (if existing)
4. Show status indicator: "Saving..." → "Saved" → error state
5. On `Ctrl+S`: immediately trigger save, reset debounce timer
6. On unmount: flush pending save synchronously via `navigator.sendBeacon`

Save request for drafts:
- `privacy: "draft"` for all autosaves
- If user explicitly publishes, change privacy to "public"

### F7.7 — Draft System (Frontend)

**File:** `frontend/src/hooks/use-draft.ts`

```typescript
interface DraftState {
  localDraftId: string; // UUID, stored in localStorage
  diaryId: string | null; // server-side diary ID after first save
  title: string;
  contentHtml: string;
  tags: string[];
  emotion: string | null;
  privacy: Privacy;
  commentsEnabled: boolean;
  updatedAt: number; // timestamp
}
```

Logic:
1. On `/diary/new`, check localStorage for `draft:<localDraftId>`
2. If draft exists, show "You have an unsaved draft. Continue editing? [Continue] [Discard]"
3. Generate `localDraftId` UUID on first edit
4. Store draft state in both localStorage and server (autosave)
5. On successful publish: clear localStorage draft entry
6. On discard: clear localStorage draft entry + DELETE server draft if exists
7. Draft recovery: on `/diary/new`, show banner: "Draft restored from [time] ago"

### F7.8 — Diary Editor Page (Frontend)

**File:** `frontend/src/app/(main)/diary/new/page.tsx`

Layout:
```
┌─────────────────────────────────────────────┐
│ [Back to diary]                    [Publish] │
│                                             │
│ ┌─ Title ──────────────────────────────────┐ │
│ │ [Title input, placeholder "Title..."]    │ │
│ └──────────────────────────────────────────┘ │
│                                             │
│ ┌─ Editor with toolbar ────────────────────┐ │
│ │ [B I U S | H1 H2 H3 | Quote Code ...]   │ │
│ │                                           │ │
│ │ [TiptapEditor content area]               │ │
│ │                                           │ │
│ │ Placeholder: "What's on your mind?"       │ │
│ └──────────────────────────────────────────┘ │
│                                             │
│ ┌─ Settings Panel (collapsible) ───────────┐ │
│ │ Privacy: [Public ▼]                      │ │
│ │ Tags:   [life ✕] [weather ✕] [input...] │ │
│ │ Emotion: [Hopeful ▼]                     │ │
│ │ Comments: [● Enabled ○ Disabled]         │ │
│ └──────────────────────────────────────────┘ │
│                                             │
│ ┌─ Bottom Bar ─────────────────────────────┐ │
│ │ Words: 342  Characters: 2,150  ● Saved   │ │
│ └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

States:
- Loading: skeleton with title placeholder + editor skeleton (3 gray lines)
- Empty (new diary): placeholder text in editor, title input empty
- Existing draft: pre-populated with draft content
- Error: inline error notification ("Could not save. Retry.")
- Unsaved changes: `beforeunload` event triggers browser warning

### F7.9 — Diary Edit Page (Frontend)

**File:** `frontend/src/app/(main)/diary/[id]/edit/page.tsx`

Pre-populated with existing diary content:
1. Fetch diary by ID via `useDiary(id)`
2. Populate title input + Tiptap editor with content_html
3. Populate settings panel with diary's tags, emotion, privacy, comments
4. On save: PUT /diaries/{id} with updated fields
5. Delete button (with confirmation dialog)
6. "Back to diary" link
7. Autosave engine enabled on edit (draft state = "already published")

### F7.10 — Settings Panel (Frontend)

**File:** `frontend/src/components/editor/editor-settings.tsx`

Collapsible right sidebar or bottom drawer:

**Privacy Selector:**
- Radio group: Public (globe icon) / Draft (pencil icon) / Private (lock icon — disabled until M08)
- Description text below each option explaining visibility
- When switching from draft to public, show confirmation: "This will publish your diary."

**Tags Input:**
- Text input with autocomplete dropdown
- As user types, debounced API call to `GET /tags/search?q=...`
- Suggestions shown in dropdown, click to add
- Added tags shown as removable badges below input
- Max 10 tags enforced
- Each tag: 1-30 chars, lowercase, alphanumeric + hyphens

**Emotion Dropdown:**
- Select from predefined list: joyful, grateful, hopeful, reflective, melancholic, anxious, sad, angry, inspired, loved, peaceful, excited, nostalgic, surprised, tired
- Each option shows emoji + label
- Nullable — no emotion selected is valid

**Comments Toggle:**
- Switch: Enabled / Disabled
- Description: "Allow readers to comment on this diary entry"
- Default: enabled (from user preferences)

### F7.11 — Tags Autocomplete (Frontend + Backend)

**Frontend:** `frontend/src/components/editor/tags-autocomplete.tsx`

```typescript
interface TagsAutocompleteProps {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number; // default 10
}

interface TagSuggestion {
  name: string;
  count: number;
}
```

- Debounced input (300ms)
- Dropdown with top-10 matching tags, sorted by count descending
- Highlight matching portion of tag name in dropdown
- Show count next to each suggestion: `life (24)`
- Keyboard navigation: arrow keys to move, enter to select, escape to close
- If typed tag has no match, allow creating new tag (show "Create 'newtag'" in dropdown)

**Backend:** `backend/app/api/v1/endpoints/tags.py`

```
GET /tags/search?q=life&limit=10
Response: { data: [{ name: "life", count: 24 }, { name: "lifestyle", count: 5 }] }
```

- Query all public diaries, aggregate unique tags matching regex `^q`
- Return sorted by count descending
- Cache result in Redis for 30 seconds (TTL)
- Case-insensitive matching

### F7.12 — Word & Character Count (Frontend)

**File:** `frontend/src/components/editor/editor-stats.tsx`

Bottom bar component:
- Word count: `editor.storage.characterCount.words()`
- Character count: `editor.storage.characterCount.characters()`
- Updates in real-time as user types
- Display: "Words: {n} · Characters: {n}"
- Uses `@tiptap/extension-character-count`

### F7.13 — Unsaved Changes Warning (Frontend)

In the editor page component:
- Track dirty state: compare current editor content + title to last-saved snapshot
- On `beforeunload`: return warning string if dirty
- On route navigation (Next.js `useRouter`): show confirmation dialog if dirty
- Reset dirty state after successful save

### F7.14 — Undo/Redo (Frontend)

Built into Tiptap StarterKit (`@tiptap/extension-history`):
- Undo: `editor.chain().focus().undo().run()`
- Redo: `editor.chain().focus().redo().run()`
- Toolbar buttons disabled when no history (canUndo/canRedo)

---

## File Structure

### New Files (Frontend)
```
frontend/src/
├── app/(main)/
│   └── diary/
│       ├── new/
│       │   └── page.tsx                  # Tiptap-based diary create page
│       └── [id]/edit/
│           └── page.tsx                  # Tiptap-based diary edit page
├── components/
│   └── editor/
│       ├── tiptap-editor.tsx              # Core Tiptap wrapper
│       ├── editor-toolbar.tsx             # Fixed formatting toolbar
│       ├── floating-toolbar.tsx           # Selection-based floating toolbar
│       ├── editor-settings.tsx            # Privacy, tags, emotion, comments panel
│       ├── tags-autocomplete.tsx          # Tag input with autocomplete
│       └── editor-stats.tsx               # Word/character count bar
├── hooks/
│   ├── use-autosave.ts                   # Autosave engine with debounce
│   └── use-draft.ts                      # Local draft management
```

### Modified Files (Frontend)
```
frontend/src/app/(main)/diary/new/page.tsx     # Replaced with Tiptap version
frontend/src/app/(main)/diary/[id]/edit/page.tsx  # Replaced with Tiptap version
frontend/package.json                          # Add Tiptap packages
```

### New Files (Backend)
```
backend/app/
├── api/v1/endpoints/
│   └── tags.py                              # Tag search/autocomplete endpoint
└── services/
    └── tag_service.py                       # Tag aggregation logic
```

### Modified Files (Backend)
```
backend/app/api/v1/router.py                  # Include tags router
backend/app/repositories/diary_repo.py        # Add draft-specific query filter
backend/app/services/diary_service.py         # Add draft-specific validation
```

---

## Database Changes

### Collections
No new collections. Drafts reuse the `diaries` collection with `privacy: "draft"`.

### New Indexes
```
{ "privacy": 1, "user_id": 1, "updated_at": -1 }  # Draft listing for owner
{ "updated_at": 1 }                                 # TTL for stale draft cleanup (with partial filter: privacy=draft)
```

### Optional Migration
- Add TTL index on `updated_at` for draft documents: expire after 7 days
- Partial filter expression: `{ "privacy": "draft" }`
- Command:
```javascript
db.diaries.createIndex(
  { "updated_at": 1 },
  {
    expireAfterSeconds: 604800,
    partialFilterExpression: { "privacy": "draft" }
  }
);
```

---

## API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|-----------|-------------|
| GET | `/tags/search` | None | 60/min/IP | Search tags by prefix (autocomplete) |
| POST | `/diaries` | Bearer | 30/min | Create diary (publish or save draft) |
| PUT | `/diaries/{id}` | Bearer | 30/min | Update diary (autosave or publish) |
| DELETE | `/diaries/{id}` | Bearer | 30/min | Delete draft (on discard) |

### Tags Search Request
```
GET /api/v1/tags/search?q=life&limit=10
```

### Tags Search Response
```json
{
  "data": [
    { "name": "life", "count": 24 },
    { "name": "lifestyle", "count": 5 },
    { "name": "lifelong-learning", "count": 3 }
  ]
}
```

### Autosave Draft Request
```json
{
  "privacy": "draft",
  "title": "A Walk in the Rain",
  "content_html": "<p>Today I walked in the rain.</p>",
  "content_text": "Today I walked in the rain.",
  "tags": ["life", "weather"],
  "emotion": "hopeful",
  "comments_enabled": true
}
```

### Autosave Draft Response (201 for new, 200 for update)
```json
{
  "data": {
    "id": "665a2b3c4d5e6f7a8b9c0d1e",
    "privacy": "draft",
    "updated_at": "2026-06-25T08:35:00Z"
  }
}
```

---

## Frontend

### Pages
- `/diary/new` — Create new diary with full Tiptap editor, settings panel, autosave
- `/diary/[id]/edit` — Edit existing diary with pre-populated content and autosave

### Components
- `TiptapEditor` — Configurable editor wrapper with all extensions
- `EditorToolbar` — Fixed toolbar with formatting buttons, active state indicators, tooltips
- `FloatingToolbar` — Selection-based mini toolbar with animated appearance
- `EditorSettings` — Collapsible panel: privacy selector, tags autocomplete, emotion, comments toggle
- `TagsAutocomplete` — Tag input with debounced API autocomplete, keyboard navigation, create-new support
- `EditorStats` — Bottom bar showing word count, character count, save status

### Hooks
- `useAutosave(diaryId?, title, contentHtml, privacy)` — Debounced autosave with status indicators, save-now trigger, sendBeacon on unmount
- `useDraft()` — localStorage draft management: create, recover, discard, detect stale drafts

### State Management
- `diary-store.ts` — Extended from M06: adds `draftId`, `isDirty`, `lastSavedAt`, `saveStatus` fields
- `useAutosave` hook manages its own transient state internally

### Routing
- `/diary/new` → created diary redirects to `/diary/{id}`
- `/diary/{id}/edit` → saved diary stays on edit page, "View diary" link navigates to reader
- Unsaved changes warning on navigating away (both `beforeunload` and Next.js route change)

### Accessibility
- All toolbar buttons have `aria-label` (e.g., "Bold (Ctrl+B)")
- Active formatting buttons use `aria-pressed="true"`
- Editor content area has `role="textbox"` and `aria-multiline="true"`
- Editor has `aria-placeholder` matching the placeholder text
- Focus is trapped in floating toolbar when open (Escape closes and returns focus to editor)
- Save status announced via `aria-live="polite"` region
- Tags autocomplete uses `role="combobox"` pattern with `aria-expanded`, `aria-activedescendant`
- Word/character count has `aria-label="Word count: 342, Character count: 2,150"`
- Color contrast: all toolbar icons meet AA standards in both themes

### Responsive Design
- Editor uses `EditorLayout` (minimal chrome, full-width, max-w-4xl centered)
- On mobile (<768px):
  - Toolbar wraps to 2 rows (no overflow menu)
  - Settings panel becomes a bottom drawer (slide-up) instead of right sidebar
  - Bottom bar fixed to bottom of viewport
- On tablet (768-1024px):
  - Toolbar single row with scrollable overflow
  - Settings panel as right sidebar (collapsible)
- On desktop (>1024px):
  - Full layout as designed above

---

## Backend

### Services
- `tag_service.py`: Aggregates unique tags from public diaries with count, supports prefix search
- `diary_service.py` (updated): Draft-specific validation (prevent publishing empty drafts, prevent privacy change from draft to private in M08)

### Business Logic

**Draft creation (autosave):**
1. Accept same fields as diary creation
2. Force `privacy: "draft"` even if client sends "public" (publish is a separate explicit action)
3. Same HTML sanitization applies
4. Insert into `diaries` collection
5. Return diary ID (used by client for subsequent autosaves)

**Draft update (autosave):**
1. Verify ownership
2. Verify diary is still a draft (not already published)
3. Partial update with provided fields
4. Reset `updated_at`
5. Return 200

**Draft publish (explicit user action):**
1. Verify ownership
2. Change `privacy` from "draft" to "public"
3. Set `published_at`
4. Increment user's `stats.diary_count`
5. Return updated diary

**Tags autocomplete:**
1. Accept `q` (prefix query, min 1 char) and `limit` (default 10, max 50)
2. Aggregate from `diaries` collection where privacy="public"
3. Unwind `tags` array, match tags with regex `^q` (case-insensitive)
4. Group by tag name, sort by count descending, limit
5. Check Redis cache before aggregation (key: `tags:search:{q}:{limit}`)
6. Return suggestions

### Repositories
- `diary_repo.py` (updated): Add filter conditions to exclude drafts in public queries, add `find_drafts_by_user` method

### Background Workers
- `cleanup_stale_drafts` — Optional periodic task (cron): delete drafts older than 7 days where `updated_at < now - 7d`. The TTL index handles this automatically; this worker is for immediate cleanup on demand.

---

## Security

### Authentication
- Diary create/update endpoints require valid Bearer token
- Tags autocomplete is public (no auth required)

### Authorization
- Draft ownership enforced on every update/delete
- Drafts invisible to non-owners at the query level (not just response filtering)
- Published diaries remain editable only by owner

### Privacy
- Drafts are never returned in public feed queries
- Tags autocomplete only aggregates from public diaries (draft/private tags not exposed)
- `beforeunload` warning is client-side only (no server-side concern)

### OWASP
- XSS: Tiptap's output is sanitized server-side via existing HTML sanitization (same as M06)
- HTML injection: content from Tiptap is sanitized even though Tiptap itself produces clean HTML
- Input validation: Pydantic validates all request fields
- CSRF: All mutating endpoints require Bearer token
- Mass assignment: Only documented fields accepted

---

## Performance

- Autosave debounce (30s) prevents excessive API calls during rapid typing
- Tags autocomplete cached in Redis (30s TTL) — aggregation runs at most once per 30 seconds per prefix
- `content_html` limited to 100KB, `content_text` to 50KB
- Draft queries use the compound index `{ privacy: 1, user_id: 1, updated_at: -1 }`
- TTL index on drafts runs in background, minimal performance impact
- `sendBeacon` on unmount is non-blocking and reliable

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_draft_created_via_api` | Unit | POST /diaries with privacy=draft creates draft |
| `test_draft_excluded_from_public_feed` | Unit | Draft not returned in GET /diaries |
| `test_draft_visible_to_owner` | Unit | Owner can GET their draft by ID |
| `test_draft_invisible_to_others` | Unit | Non-owner gets 404 on draft |
| `test_draft_update` | Unit | Owner can update draft content |
| `test_draft_publish` | Unit | Changing draft to public sets published_at |
| `test_draft_delete` | Unit | Owner can delete draft |
| `test_autosave_reuses_diary_id` | Unit | Consecutive saves update same document |
| `test_tags_search_prefix` | Unit | Tags search returns matching results |
| `test_tags_search_empty_query` | Unit | Empty q returns 422 |
| `test_tags_search_case_insensitive` | Unit | "Life" matches "life" |
| `test_tags_search_cached` | Integration | Redis cache hit returns fast |
| `test_diary_privacy_no_change_to_private` | Unit | Draft→public allowed, public→private rejected |
| `test_stale_draft_ttl` | Integration | Old drafts are auto-cleaned |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| TiptapEditor renders | Unit | Editor mounts with placeholder |
| Editor toolbar button states | Unit | Active/inactive states correct per format |
| Floating toolbar appears on selection | Unit | Mini toolbar shows on text select |
| Floating toolbar disappears on blur | Unit | Mini toolbar hides on editor blur |
| Bold formatting works | Unit | Ctrl+B toggles bold |
| Markdown shortcut # → H1 | Unit | Typing "# " converts to heading |
| Autosave fires after 30s | Integration | Timer triggers API call after inactivity |
| Save status indicator | Unit | Shows "Saving..." → "Saved" → error states |
| Draft recovery on page load | Integration | localStorage draft restored to editor |
| Draft discard clears localStorage | Unit | Discard button removes draft from storage |
| Unsaved changes warning | Unit | beforeunload fires when dirty |
| Tags autocomplete shows suggestions | Unit | Dropdown appears on input, shows suggestions |
| Tags keyboard navigation | Unit | Arrow keys + Enter works in dropdown |
| Settings panel privacy selector | Unit | Selecting privacy updates state |
| Word/character count updates | Unit | Count reflects editor content changes |
| Undo/redo buttons | Unit | History buttons enable/disable correctly |
| Loading skeleton | Unit | Skeleton shows while diary data loads |

---

## Documentation

- `docs/api.md` — Update with tags search endpoint
- `docs/milestones/milestone-07.md` — This document
- `docs/frontend-design.md` — Add Tiptap editor usage, toolbar design, autosave architecture
- `docs/architecture.md` — Update data flow for draft lifecycle

---

## Acceptance Criteria

1. The `/diary/new` page renders a full Tiptap editor with toolbar, settings panel, and bottom bar.
2. Bold, Italic, Underline, Strikethrough, H1-H3, Blockquote, Code Block, Bullet List, Ordered List, Check List all work.
3. Selecting text shows the floating toolbar with formatting options.
4. Markdown shortcuts (`#`, `**`, `*`, `>`, `-`) convert to formatted text.
5. Keyboard shortcuts (Ctrl+B, Ctrl+I, etc.) work as expected.
6. Autosave fires 30 seconds after the user stops typing and shows a "Saved" indicator.
7. Drafts survive browser close: reopening `/diary/new` recovers the unsaved draft.
8. Publishing a draft moves it to the public feed and clears the local draft.
9. The settings panel lets the user select privacy, add tags (with autocomplete), choose emotion, and toggle comments.
10. Tags autocomplete suggests existing tags from the database as the user types.
11. The bottom bar shows live word and character counts.
12. Navigating away with unsaved changes triggers a browser warning.
13. Editing an existing diary pre-populates the editor with its content.
14. Drafts are invisible to other users and never appear in the public feed.
15. All editor tests pass (`make test`).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Tiptap SSR hydration mismatch | Medium | Use `dynamic(() => import(...), { ssr: false })` for the editor component |
| Large content causes editor lag | Low | 100KB content limit; Tiptap handles this well |
| Autosave saves incomplete content | Low | Debounce ensures user has stopped typing; sendBeacon on tab close is reliable |
| localStorage draft conflicts with server draft | Low | Draft ID stored in localStorage matches server diary ID; consistency check on recovery |
| Tiptap bundle size | Medium | Use `dynamic import` with `ssr: false`; tree-shake unused extensions |
| Tags aggregation slow with many diaries | Low | Compound index + Redis caching; limit to 50 results |

---

## Future Considerations

- Milestone 08 adds the Private privacy option in the settings panel, with client-side encryption.
- Milestone 09 adds the comments section below the editor reader (not the editor itself).
- Milestone 10 indexes only published (public) diaries in Meilisearch — drafts and private diaries excluded.
- Milestone 13 adds image upload directly into the Tiptap editor via drag-and-drop and paste.
- The autosave engine can be extended to support conflict resolution (server version vs local version) in a future milestone.
- Tags autocomplete can be extended in M10 to use Meilisearch for faster prefix search.
- Collaborative editing (multiple users editing the same diary) is out of scope but the Tiptap architecture supports it via `@tiptap/extension-collaboration` and y.js.
