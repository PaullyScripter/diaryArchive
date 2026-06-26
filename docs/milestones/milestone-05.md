# Milestone 05 — User Profiles

## Overview

**Goal:** Users have customizable profiles. Profile pages are public and readable. Settings pages allow editing of profile fields, email, and preferences.

**Purpose:** Profiles are the public face of every user. They establish identity, build trust, and enable the social layer (following, community). Settings provide user agency over their data and experience.

**Dependencies:** Milestone 04 (Authentication)

---

## Architecture Impact

### Backend
- New user profile endpoints (GET profile, PUT own profile, PUT email)
- Public profile with denormalized stats (diary_count, follower_count, following_count)
- Profile enrichment: `is_following` flag when viewed by an authenticated user
- Email management: add/change/remove with verification
- Username is immutable after creation

### Frontend
- Public profile page with avatar, bio, quote, feeling, stats, tabs
- Settings page with 3 tab views: Profile, Account, Preferences
- Avatar upload widget (preview, crop — using file input for now, actual upload to MinIO in M13)
- Theme preference in settings syncs with ThemeProvider

### Database
- `users` collection fields are all already defined in M02 schema
- No new collections needed

### API
- 4 new endpoints: GET profile, PUT own profile, PUT email, GET user diaries
- Profile responses follow the standard `{ data: { ... } }` envelope

### Security
- Profile updates require authentication
- Email changes require verification (future)
- Only public fields exposed on public profile
- Private fields (email, preferences) only visible to the owner via `/auth/me`

---

## Features

### F5.1 — Profile Endpoints (Backend)

**F5.1.1 — GET /users/{username}**

Get a user's public profile.

- Auth: Optional (returns `is_following` if authenticated)
- Look up user by username (case-sensitive)
- Return 404 if not found, 403 if banned
- Response: `{ data: { id, username, avatar_path, about, favorite_quote, currently_feeling, stats (diary_count, follower_count, following_count), created_at, is_following } }`

**F5.1.2 — PUT /users/me**

Update the current user's profile.

- Auth: Bearer access token required
- Partial update: only provided fields are modified
- Fields: `avatar_path`, `about` (max 500), `favorite_quote` (max 300), `currently_feeling` (max 50), `preferences` (object with theme, comments_disabled, email_notifications, notify_on_*)
- Validation: `preferences.theme` must be "light", "dark", or "system"
- Response: `{ data: { id, username, about, favorite_quote, currently_feeling, updated_at } }`

**F5.1.3 — PUT /users/me/email**

Add, change, or remove email.

- Auth: Bearer access token required
- Request: `{ email: string | null }`
- If email provided: encrypt with AES-256-GCM, store hash for uniqueness check, set `email_verified: false`, send verification email
- If null: clear email fields
- Validation: valid email format, unique across users
- Response: `{ data: { has_email, email_verified, message } }`

**F5.1.4 — GET /users/{username}/diaries**

List a user's public diaries.

- Auth: Optional
- Query: `page`, `per_page`, `sort` (created_at, updated_at), `order` (asc, desc)
- Only returns public diaries (not private or draft)
- Response: standard paginated diary list (envelope: { data: [...], meta: { page, per_page, total, has_next, has_prev } })

### F5.2 — Profile Page (Frontend)

**File:** `frontend/src/app/(main)/profile/[username]/page.tsx`

**Profile Header:**
- Large avatar (96px desktop, 64px mobile) with fallback initials
- Username as heading
- Bio text (about)
- "Currently feeling" emotion badge
- Stats row: X diaries · Y followers · Z following
- Follow/Unfollow button (if viewing another user — wired in M09)
- Edit Profile button (if viewing own profile)

**Tabs:**
- About: full bio, favorite quote, join date
- Diaries: grid of DiaryCards (paginated)
- Followers: list of user cards (wired in M09)
- Following: list of user cards (wired in M09)

**States:**
- Loading: skeleton for header + skeleton cards for diaries
- Empty: "No diaries yet. The blank page is waiting." + Write button
- Error: inline error message with retry

### F5.3 — Settings Page (Frontend)

**File:** `frontend/src/app/(main)/settings/page.tsx`

Three tabs via shadcn/ui Tabs component:

**Profile Tab:**
- Avatar upload: click to upload, preview, crop (basic file input; MinIO integration in M13)
- About: textarea (max 500 chars), character counter
- Favorite quote: input (max 300 chars)
- Currently feeling: select or input (max 50 chars)
- Save button (disabled until changes detected)

**Account Tab:**
- Username (display only, immutable)
- Email section: show current email status (has_email, verified), Add/Change/Remove button
- Change password: current password + new password + confirm
- Danger zone: Delete account with confirmation dialog (type username to confirm)

**Preferences Tab:**
- Theme selector: System / Light / Dark (radio or select)
- Notification toggles: each type (like, comment, follow, bookmark) as Switch component
- Email notifications: toggle (disabled if no email)
- Default comment setting for new diaries: toggle

### F5.4 — Avatar Component (Frontend)

**File:** `frontend/src/components/shared/avatar.tsx`

- Circular image with fallback initials
- Props: `src` (URL or null), `alt`, `size` (sm: 32px, md: 40px, lg: 64px, xl: 96px)
- Fallback: first letter of username, background color from hash
- Skeleton variant for loading state

### F5.5 — Stats Display Component (Frontend)

**File:** `frontend/src/components/shared/stats-display.tsx`

- Displays: diary count, follower count, following count
- Each stat is an icon + number + label
- Horizontal layout, centered

---

## File Structure

### New Files (Backend)
```
backend/app/
├── api/v1/endpoints/
│   └── users.py                     # User profile endpoints
└── services/
    └── user_service.py              # Profile update business logic
```

### Modified Files (Backend)
```
backend/app/api/v1/router.py         # Include users router
backend/app/models/user.py           # Already exists from M02 — may need UserProfileResponse
```

### New Files (Frontend)
```
frontend/src/
├── app/(main)/
│   ├── profile/
│   │   └── [username]/
│   │       └── page.tsx             # Public profile page
│   └── settings/
│       └── page.tsx                 # Settings page with tabs
├── components/
│   └── shared/
│       ├── avatar.tsx               # Avatar with fallback initials
│       ├── stats-display.tsx        # Diary/follower/following counts
│       └── tab-nav.tsx              # Reusable tab navigation (optional)
└── hooks/
    └── use-user.ts                  # TanStack Query hook for user data
```

### Modified Files (Frontend)
```
frontend/src/components/layout/navbar.tsx    # Add "/settings" to avatar dropdown
frontend/package.json                        # Add @tanstack/react-query
```

---

## Database Changes

No schema changes. All `users` collection fields already defined.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/{username}` | Optional | Public profile |
| PUT | `/users/me` | Bearer | Update own profile |
| PUT | `/users/me/email` | Bearer | Add/change/remove email |
| GET | `/users/{username}/diaries` | Optional | User's public diaries |

### Profile Response

```json
{
  "data": {
    "id": "665a1b2c3d4e5f6a7b8c9d0e",
    "username": "moonwriter",
    "avatar_path": null,
    "about": "writing my thoughts, one diary at a time",
    "favorite_quote": "The unexamined life is not worth living.",
    "currently_feeling": "hopeful",
    "stats": { "diary_count": 24, "follower_count": 8, "following_count": 12 },
    "created_at": "2025-12-01T14:30:00Z",
    "is_following": true
  }
}
```

---

## Frontend

### Pages
- `/profile/[username]` — Public profile with tabs
- `/settings` — Settings with Profile/Account/Preferences tabs

### Components
- `Avatar` — Circular image with fallback initials, multiple sizes
- `StatsDisplay` — Icon + number for diary/follower/following counts
- Settings forms for each tab

### Hooks
- `useUser(username)` — TanStack Query for fetching user profile (GET /users/{username})
- `useUpdateProfile()` — TanStack Query mutation for PUT /users/me

### State Management
- Auth store already handles user state; settings updates call the API and refresh the store

### Accessibility
- Avatar images have descriptive alt text
- Settings form labels are visible
- Save buttons show loading state and disable during submission
- Tab navigation uses proper ARIA roles (`role="tablist"`, `role="tab"`, `aria-selected`)
- Color contrast for stat numbers meets AA standards

### Responsive Design
- Profile header stacks vertically on mobile (avatar centered, stats in a row below)
- Settings tabs become a vertical list on mobile (no horizontal scroll)
- Avatar sizes: 96px desktop → 64px mobile

---

## Backend

### Services
- `user_service.py`: Orchestrates profile updates, email changes, profile enrichment (`is_following`)

### Business Logic

**Profile update:**
1. Validate input fields (length limits, enum values)
2. Build `$set` document with only provided fields
3. Update user document
4. Return updated fields

**Email change:**
1. Validate email format (or null for removal)
2. If email provided: encrypt with AES-256-GCM, compute SHA-256 hash, check uniqueness
3. Set `email_verified: false` (new verification flow in future)
4. If null: clear all email fields
5. Update user document, return new status

---

## Security

### Authentication
- Profile update endpoints require valid Bearer token
- Email change requires authentication (verified by current password or existing session)

### Authorization
- Users can only update their own profile (`get_current_user` enforces this)
- Username immutability is enforced server-side (not in the update schema)

### Privacy
- Public profile never exposes email, password_hash, or internal flags
- `has_email` boolean is the only email-related field exposed
- Banned users' profiles return 403
- Email verification prevents email squatting

### OWASP
- Length limits on all text fields prevent storage abuse
- Input validation via Pydantic prevents injection

---

## Performance

- Profile lookups use the unique `username` index — O(log n)
- Stats are denormalized on the user document (no count queries needed)
- Profile enrichment (`is_following`) requires one additional DB lookup per profile view

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_get_profile_success` | Unit | Valid username returns profile |
| `test_get_profile_not_found` | Unit | Non-existent username returns 404 |
| `test_get_profile_banned` | Unit | Banned user profile returns 403 |
| `test_update_profile` | Unit | Update all fields, verify changes persist |
| `test_update_profile_partial` | Unit | Update single field, others unchanged |
| `test_update_profile_unauthorized` | Unit | No token returns 401 |
| `test_add_email` | Unit | Add email, verify encrypted storage |
| `test_remove_email` | Unit | Remove email, verify fields cleared |
| `test_duplicate_email` | Unit | Already-used email returns 409 |
| `test_get_user_diaries` | Unit | Returns paginated public diaries |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| Profile page renders | Unit | Loading → data → error states |
| Avatar fallback | Unit | No image shows initials |
| Settings save | Unit | Form submission calls API |
| Settings tabs | Unit | Switching tabs shows correct content |

---

## Documentation

- `docs/api.md` — Update with user profile and settings endpoints
- `docs/milestones/milestone-05.md` — This document

---

## Acceptance Criteria

1. Visiting `/profile/{username}` shows the user's public profile with avatar, bio, stats, and diaries.
2. Visiting `/profile/{nonexistent}` returns a 404 page.
3. Visiting `/profile/{banned_user}` returns a 403 page.
4. The Edit Profile button appears only on the user's own profile page.
5. The settings page has 3 tabs: Profile, Account, Preferences — all functional.
6. Updating the profile (about, quote, feeling) immediately reflects on the profile page.
7. Adding/changing/removing email updates the user's email status.
8. Changing the theme in settings persists across page reloads.
9. The password change form correctly validates old password, enforces new password rules.
10. The avatar component renders with fallback initials when no image is set.
11. All profile and settings tests pass (`make test`).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Username enumeration | Low | 404 for non-existent users is standard; no timing side-channels |
| Email uniqueness race | Low | Unique sparse index on `email_hash` prevents duplicates at DB level |
| Avatar storage | Medium | Milestone 13 adds MinIO integration; for now, avatar_path is a URL string stored in DB |
| Large bio text abuse | Low | 500-char max enforced at Pydantic + DB level |

---

## Future Considerations

- Milestone 09 adds follow/unfollow functionality, populating the Followers/Following tabs.
- Milestone 13 adds MinIO upload for avatars (replacing the URL string with actual file upload).
- Milestone 04 already handles email verification; the verification email sending will be implemented when SMTP is configured (M15).
- Account deletion with cascade is documented in the database design (M17 in database.md) but needs UI in a future milestone.
