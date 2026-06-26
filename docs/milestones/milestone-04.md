# Milestone 04 — Authentication

## Overview

**Goal:** Users can register, log in, log out, and maintain sessions. Protected routes work on the frontend. Auth state is reflected in the NavBar.

**Purpose:** Authentication is the gatekeeper for all personalized features. Without it, users cannot create diaries, comment, like, follow, or manage their profile. This milestone establishes the identity layer that the entire application depends on.

**Dependencies:** Milestone 02 (Backend Foundation), Milestone 03 (Frontend Foundation)

---

## Architecture Impact

### Backend
- Password hashing with Argon2id via `passlib`
- JWT access tokens (15-min expiry, HS256) via `python-jose`
- Random refresh tokens (256-bit, stored as SHA-256 hash in MongoDB)
- Token rotation on refresh (old refresh token revoked, new one issued)
- Rate limiting on auth endpoints (5/min for register, 10/min for login, 20/min for refresh)
- `get_current_user` FastAPI dependency for protected routes
- Ban check during login and token verification

### Frontend
- Auth store (Zustand) for client-side user state
- API client base with auth header injection and auto-refresh interceptor
- Login and register pages with validation
- NavBar becomes auth-aware: shows avatar dropdown, Write button, notification bell when authenticated
- Protected route wrapper that redirects to login

### Database
- `users` collection: stores `password_hash`, `email_encrypted`, `email_hash`, `email_verified`, `is_banned`, `last_login_at`
- `refresh_tokens` collection: stores SHA-256 hash, user_id, expiry
- `password_reset_tokens` collection: stores password reset token hashes (for M04.2)

### API
- 9 new auth endpoints (see below)
- All use the standard `{ "data": { ... } }` envelope

### Security
- Argon2id password hashing (memory-hard, resists GPU/ASIC)
- Passwords never returned in responses
- Email encrypted at rest (AES-256-GCM) — server never stores plaintext email
- Refresh tokens stored as SHA-256 hashes (not plaintext)
- Rate limiting prevents brute force
- JWT short expiry limits leaked-token window
- Ban enforcement at authentication time
- Password reset tokens single-use, 1-hour expiry

---

## Features

### F4.1 — Password Hashing (Backend)

**File:** `backend/app/core/security.py`

Implement Argon2id password hashing using `passlib`:

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

Parameters (Argon2id):
- Memory: 64 MB
- Iterations: 3
- Parallelism: 4
- Output: 256 bits

### F4.2 — JWT Token Service (Backend)

**File:** `backend/app/core/security.py`

- `create_access_token(user_id, username, is_admin)`: creates JWT with `sub`, `username`, `is_admin`, `exp` (15min), `iat`, `jti`
- `decode_access_token(token)`: verifies and decodes JWT, raises `AuthenticationException` on expiry or invalid signature
- Algorithm: HS256, secret from `settings.secret_key`

### F4.3 — Refresh Token Service (Backend)

**File:** `backend/app/core/security.py`

- `generate_refresh_token()`: returns 32 random bytes (hex-encoded)
- `hash_token(token)`: returns SHA-256 hex digest
- Refresh token doc stored in `refresh_tokens` collection: `{ user_id, token_hash, expires_at, created_at }`

### F4.4 — Auth Router & Endpoints (Backend)

**File:** `backend/app/api/v1/endpoints/auth.py`

| Endpoint | Method | Auth | Rate Limit | Purpose |
|----------|--------|------|-----------|---------|
| `/auth/register` | POST | None | 5/min/IP | Create account |
| `/auth/login` | POST | None | 10/min/IP | Sign in |
| `/auth/refresh` | POST | Cookie | 20/min/IP | Refresh access token |
| `/auth/logout` | POST | Bearer | — | Invalidate refresh token |
| `/auth/me` | GET | Bearer | — | Get current user profile |
| `/auth/change-password` | PUT | Bearer | — | Change password |
| `/auth/request-password-reset` | POST | None | 3/hr/email | Request reset email |
| `/auth/reset-password` | POST | None | 5/hr/token | Reset password with token |

**F4.4.1 — POST /auth/register**
- Request: `{ username (3-20 chars, alphanumeric + underscore), password (8-128 chars, at least one letter and one digit), email (optional) }`
- Validate input, check username uniqueness (case-insensitive), check email uniqueness (if provided)
- Hash password, encrypt email if provided (AES-256-GCM), create user document
- Generate access + refresh tokens, set refresh_token httpOnly cookie
- Response 201: `{ data: { id, username, created_at, access_token } }`
- Set-Cookie: `refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800`

**F4.4.2 — POST /auth/login**
- Request: `{ username, password }`
- Find user by username, verify password, check ban status
- Update `last_login_at`, generate tokens
- Response 200: `{ data: { id, username, is_admin, access_token } }`
- Set-Cookie: same as register

**F4.4.3 — POST /auth/refresh**
- Read refresh_token from cookie, hash it, find in DB
- Verify not expired, check user not banned
- Delete old token, issue new refresh token (rotation), issue new access token
- Response 200: `{ data: { access_token } }`
- Set-Cookie: new refresh_token

**F4.4.4 — POST /auth/logout**
- Read refresh_token from cookie, delete from DB
- Response 204, Clear-Cookie

**F4.4.5 — GET /auth/me**
- Requires Bearer token
- Return full user profile (excluding password_hash, email_encrypted, email_hash)
- Response: `{ data: { id, username, avatar_path, about, favorite_quote, currently_feeling, has_email, email_verified, preferences, stats, is_admin, created_at, last_login_at } }`

**F4.4.6 — PUT /auth/change-password**
- Request: `{ current_password, new_password }`
- Verify current password, validate new password rules
- Hash new password, update user document
- Revoke ALL refresh tokens for this user
- Response 200: `{ data: { message } }`

**F4.4.7 — POST /auth/request-password-reset**
- Request: `{ username }`
- If user exists and has email, generate reset token, store hash in `password_reset_tokens`, send email (SMTP)
- Always return 200 (prevent username enumeration)
- Response: `{ data: { message: "If this account has an email, a reset link has been sent." } }`

**F4.4.8 — POST /auth/reset-password**
- Request: `{ token, new_password }`
- Hash token, find in `password_reset_tokens`, verify not expired and not used
- Mark token as used, change password, revoke all refresh tokens
- Clear `encrypted_master_key` and `master_key_salt` (private diaries become unreachable)
- Response 200: `{ data: { message: "Password reset successfully." } }`

### F4.5 — FastAPI Dependencies (Backend)

**File:** `backend/app/api/deps.py`

- `get_current_user`: decode Bearer token from Authorization header, load user from DB by `sub` (user_id), raise 401 if missing/invalid, raise 403 if banned
- Return User document from MongoDB

### F4.6 — Rate Limiting (Backend)

**File:** `backend/app/core/security.py` or `backend/app/core/deps.py`

- Simple in-memory rate limiter using Redis sorted sets (sliding window)
- Middleware or dependency that checks rate limit for auth endpoints
- Keys: `rate_limit:{endpoint}:{ip}` with TTL matching the window

### F4.7 — Auth Store (Frontend)

**File:** `frontend/src/store/auth-store.ts`

Zustand store:
```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setUser: (user: User) => void;
}
```

- Access token stored in memory (not localStorage — XSS safe)
- Refresh token in httpOnly cookie (set by server, not accessible to JS)
- `login()` calls POST /auth/login, stores access token in memory, sets user
- `refreshAuth()` calls POST /auth/refresh, updates access token
- `logout()` calls POST /auth/logout, clears state

### F4.8 — API Client Base (Frontend)

**File:** `frontend/src/lib/api/client.ts`

- Axios or fetch wrapper
- Base URL: `process.env.NEXT_PUBLIC_API_URL`
- Request interceptor: inject `Authorization: Bearer <access_token>` header
- Response interceptor: on 401, call `/auth/refresh`, retry original request (once)
- If refresh also fails, redirect to `/login`

### F4.9 — Auth Provider & Protected Routes (Frontend)

**File:** `frontend/src/components/providers/auth-provider.tsx`

- On app load, attempt to call `/auth/me` via the refresh token cookie
- If successful, populate auth store with user
- If failed, user remains anonymous
- Wrap app in `<AuthProvider>` inside `<ThemeProvider>`

**File:** `frontend/src/components/shared/protected-route.tsx`
- Wrapper component that checks `isAuthenticated` from auth store
- If not authenticated, redirect to `/login?redirect=<path>`
- If authenticated, render children

### F4.10 — Auth-Aware NavBar (Frontend)

Update `navbar.tsx` to react to auth state:

**Authenticated state replaces:**
- "Log in" / "Register" buttons → User avatar dropdown
- Avatar dropdown items: "My Diaries", "Bookmarks", "Likes", "Settings", "Log out"
- "Write" button (prominent, links to `/diary/new`) appears
- Notification bell with unread count (placeholder — wired in M11)

### F4.11 — Login & Register Pages (Frontend)

Upgrade from placeholders to functional pages:

**Login (`frontend/src/app/(auth)/login/page.tsx`):**
- Form: username input, password input, submit button
- Client-side validation: both fields required
- Error display: inline error messages (wrong credentials, rate limited)
- Loading state: button shows spinner, disabled during submission
- On success: redirect to `/` or `?redirect` target
- Link to register

**Register (`frontend/src/app/(auth)/register/page.tsx`):**
- Form: username, password, optional email
- Client-side validation: username pattern, password strength (min 8 chars, letter + digit)
- Show password strength indicator (visual bar: weak/medium/strong)
- Error display: inline for duplicate username, weak password, etc.
- Privacy warning: "If you lose your username and have no email, your account cannot be recovered."
- Loading state: button spinner during submission
- On success: redirect to `/`
- Link to login

### F4.12 — Password Strength Indicator (Frontend)

**File:** `frontend/src/components/auth/password-strength.tsx`

- Visual bar that fills from red → yellow → green
- Rules checked: length ≥8, has lowercase, has uppercase, has digit, has special char
- Score 0-5 mapped to Weak/Medium/Strong labels
- Real-time update as user types

---

## File Structure

### New Files (Backend)
```
backend/app/
├── api/
│   ├── deps.py                      # get_current_user, get_db, get_redis
│   └── v1/endpoints/
│       └── auth.py                  # All auth endpoints
├── core/
│   └── security.py                  # hash_password, verify_password, JWT, refresh tokens, rate limiting
├── repositories/
│   └── refresh_token_repo.py        # CRUD for refresh_tokens collection
│   └── password_reset_token_repo.py # CRUD for password_reset_tokens collection
└── models/
    └── token.py                     # TokenResponse, TokenPayload models
```

### Modified Files (Backend)
```
backend/app/main.py                  # Register auth router
backend/app/api/v1/router.py         # Include auth router
backend/app/schemas/refresh_token.py # Already exists from M02
backend/app/schemas/password_reset_token.py # Already exists from M02
backend/app/core/exceptions.py       # Already has AuthenticationException, RateLimitException
```

### New Files (Frontend)
```
frontend/src/
├── app/(auth)/
│   ├── login/page.tsx               # Functional login form
│   └── register/page.tsx            # Functional registration form
├── components/
│   ├── auth/
│   │   └── password-strength.tsx    # Visual password strength indicator
│   ├── providers/
│   │   └── auth-provider.tsx        # Auth state initialization on app load
│   └── shared/
│       └── protected-route.tsx      # Auth gate wrapper
├── lib/
│   └── api/
│       └── client.ts               # API client with auth interceptor
└── store/
    └── auth-store.ts               # Zustand auth state
```

### Modified Files (Frontend)
```
frontend/src/components/layout/navbar.tsx    # Auth-aware state (avatar dropdown, Write button)
frontend/src/app/layout.tsx                  # Add AuthProvider
frontend/package.json                        # Zustand dependency
```

---

## Database Changes

### Collections
- `users` — already created in M02, now populated with real data
- `refresh_tokens` — already created in M02
- `password_reset_tokens` — already created in M02

### New Indexes
No new indexes needed — all defined in M02.

### Migrations
None. Schema is additive.

---

## API Endpoints

| Method | Path | Auth | Rate Limit | Request Body | Response |
|--------|------|------|-----------|-------------|----------|
| POST | `/auth/register` | None | 5/min/IP | `{ username, password, email? }` | `{ data: { id, username, created_at, access_token } }` + Set-Cookie |
| POST | `/auth/login` | None | 10/min/IP | `{ username, password }` | `{ data: { id, username, is_admin, access_token } }` + Set-Cookie |
| POST | `/auth/refresh` | Cookie | 20/min/IP | — | `{ data: { access_token } }` + Set-Cookie |
| POST | `/auth/logout` | Bearer | — | — | 204 + Clear-Cookie |
| GET | `/auth/me` | Bearer | — | — | `{ data: { user profile } }` |
| PUT | `/auth/change-password` | Bearer | — | `{ current_password, new_password }` | `{ data: { message } }` |
| POST | `/auth/request-password-reset` | None | 3/hr/email | `{ username }` | `{ data: { message } }` |
| POST | `/auth/reset-password` | None | 5/hr/token | `{ token, new_password }` | `{ data: { message } }` |

### Validation Rules

| Field | Rules |
|-------|-------|
| username | Required. 3-20 chars. Regex: `^[a-zA-Z0-9_-]+$`. Case-insensitive. |
| password | Required. 8-128 chars. At least one letter and one digit. |
| email | Optional. Valid email format if provided. Max 254 chars. |

---

## Frontend

### Pages
- `/login` — Functional login form with validation, error handling, loading state, redirect support
- `/register` — Functional registration with password strength indicator, privacy warning

### Components
- `PasswordStrength` — Real-time visual feedback during registration
- `ProtectedRoute` — Auth gate that redirects unauthenticated users
- `AuthProvider` — Initializes auth state on app hydration

### Hooks
- `useAuth` — Wrapper around auth store for convenient access (optional, can use store directly)

### State Management
- `auth-store.ts` — Zustand store for user state, access token, login/logout/refresh actions

### Routing
- Protected routes redirect to `/login?redirect=<path>` if unauthenticated
- Auth routes (login, register) redirect to `/` if already authenticated
- Non-existent routes: 404 page

### Accessibility
- Form labels visible (no hidden labels)
- Error messages associated via `aria-describedby` or `aria-invalid`
- Loading states announced by screen readers (ARIA live region or `aria-busy`)
- Password visibility toggle (eye icon) for password fields
- Focus management on form submission (focus first error field)

### Responsive Design
- Auth forms are already inside `AuthLayout` (centered card, max-w-md)
- Forms are mobile-friendly at all viewport sizes

---

## Backend

### Services
- `auth_service.py` (or inline in `auth.py`): Orchestrates registration, login, token refresh, logout, password change, password reset

### Business Logic

**Registration flow:**
1. Validate input → 422 if invalid
2. Check username uniqueness → 409 if taken
3. Check email uniqueness (if provided) → 409 if taken
4. Hash password (Argon2id)
5. Encrypt email (AES-256-GCM) if provided
6. Create user document with defaults
7. Generate access + refresh tokens
8. Set refresh token cookie
9. Return user + access token

**Login flow:**
1. Find user by username → 404 (generic "invalid credentials" to prevent enumeration)
2. Verify password → 401 if wrong
3. Check `is_banned` → 403 if banned
4. Update `last_login_at`
5. Generate tokens, set cookie
6. Return user + access token

**Token refresh flow:**
1. Read refresh token from cookie
2. Hash it, find in `refresh_tokens` collection
3. Check expiry → 401 if expired
4. Check user ban status → 403 if banned
5. Delete old refresh token (rotation)
6. Generate new refresh + access tokens
7. Set new cookie
8. Return new access token

**Logout flow:**
1. Read refresh token from cookie
2. Delete from `refresh_tokens`
3. Clear cookie
4. Return 204

### Repositories
- `RefreshTokenRepository`: `create`, `find_by_hash`, `delete`, `delete_all_for_user`
- `PasswordResetTokenRepository`: `create`, `find_by_hash`, `mark_used`, `delete_expired`

### Background Workers
- `cleanup_expired_tokens` — Could be a periodic task in M14; TTL index handles cleanup for now.

---

## Security

### Authentication
- Argon2id password hashing (memory-hard, salt auto-generated by passlib)
- JWT signed with HS256 using server secret
- Access tokens: 15-minute expiry, short window for leaked tokens
- Refresh tokens: 256-bit random, stored as SHA-256 hash, 7-day expiry
- Token rotation on refresh (old token revoked)

### Authorization
- `get_current_user` dependency verifies JWT on every protected route
- Ban check at authentication time (login rejected, token refresh rejected)
- No admin-only endpoints yet (M12)

### Privacy
- Email encrypted with AES-256-GCM before storage
- Email never returned in API responses (only `has_email` boolean)
- Passwords never logged or returned
- Rate limiting prevents enumeration attacks (always return 200 for password reset request)

### OWASP Considerations
- Injection: All inputs validated with Pydantic
- XSS: Auth endpoints return JSON only, no HTML rendering
- CSRF: Refresh token set with `SameSite=Strict`, only sent on same-site requests
- Broken authentication: Rate limiting on auth endpoints, account lockout via ban flag
- Sensitive data exposure: No passwords or emails in logs

---

## Performance

- JWT verification is O(1), no DB lookup for access token validation
- Refresh token lookup uses unique index on `token_hash` — sub-millisecond
- Rate limiting uses Redis sorted sets — O(log n) per check
- Password hashing is intentionally slow (Argon2id) — this is a security feature, not a bottleneck at expected scale (<10 req/s on register)

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_register_success` | Unit | Valid registration returns 201 with user and tokens |
| `test_register_duplicate_username` | Unit | Returns 409 |
| `test_register_weak_password` | Unit | Returns 422 |
| `test_login_success` | Unit | Valid credentials return 200 with tokens |
| `test_login_wrong_password` | Unit | Returns 401 |
| `test_refresh_token` | Unit | Valid refresh token returns new access token |
| `test_refresh_rotated` | Unit | Old refresh token invalidated after use |
| `test_logout` | Unit | Refresh token is revoked |
| `test_banned_user_cannot_login` | Unit | Returns 403 |
| `test_change_password` | Unit | Password updated, old tokens revoked |
| `test_password_reset_flow` | Integration | Full reset flow succeeds |
| `test_rate_limit` | Integration | Exceeding limit returns 429 |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| Login form validation | Unit | Empty fields show errors |
| Register form validation | Unit | Invalid username/password show errors |
| Password strength indicator | Unit | Weak/medium/strong display correctly |
| Auth store | Unit | Login sets user, logout clears user |
| Protected route redirect | Unit | Visiting protected page without auth redirects to /login |
| NavBar auth states | Unit | Anonymous vs authenticated renders correct buttons |

---

## Documentation

- `docs/api.md` — Update with auth endpoint details, request/response schemas, error codes
- `docs/milestones/milestone-04.md` — This document

---

## Acceptance Criteria

1. A user can register with a username and password. They receive an access token and a refresh token cookie.
2. A user can log in with their credentials. They receive a new access token and refresh token cookie.
3. An access token can be used to authenticate requests via the `Authorization: Bearer` header.
4. A refresh token can be exchanged for a new access token when the old one expires.
5. Logout invalidates the refresh token.
6. Navigating to `/login` while authenticated redirects to `/`.
7. Navigating to `/register` while authenticated redirects to `/`.
8. Visiting a protected route without authentication redirects to `/login`.
9. The NavBar shows "Log in" and "Register" buttons for anonymous users.
10. The NavBar shows avatar dropdown, "Write" button, and notification bell for authenticated users.
11. The password strength indicator updates in real-time during registration.
12. On password change, all existing sessions (refresh tokens) are invalidated.
13. A banned user receives 403 on login attempt.
14. Rate limiting returns 429 after exceeding limits on auth endpoints.
15. All auth tests pass (`make test` from backend).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| JWT secret leaked | Low | Rotate immediately; short-lived access tokens limit exposure |
| Refresh token stolen | Low | HttpOnly + Secure + SameSite cookies prevent JS access; rotation limits window |
| Argon2id too slow on low-end hardware | Low | Tune parameters if needed; registration is infrequent |
| Rate limiting by IP behind proxy | Medium | Configure `X-Forwarded-For` header trust; use real IP from Nginx |
| Password reset DoS | Low | 3/hour per email limit prevents abuse |

---

## Future Considerations

- Milestone 05 builds user profiles on top of the auth system.
- Milestone 08 uses the password for E2E encryption key derivation.
- Milestone 12 adds admin user management (ban, role change, audit).
- SMTP email sending for password reset is implemented here but not tested until a real SMTP server is available (M15 for production, can use Mailpit in dev).
