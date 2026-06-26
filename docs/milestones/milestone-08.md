# Milestone 08 — Private Diaries & Encryption

## Overview

**Goal:** Users can create private diaries with true end-to-end encryption. The server stores only ciphertext and cannot read the content. Private diaries are invisible in public listings and search results.

**Purpose:** Privacy is a core value of DiaryArchive. Many users want a secure space for personal thoughts — a digital journal that even the platform cannot access. This milestone delivers cryptographic trust: the server is treated as an untrusted storage layer. Encryption and decryption happen entirely in the browser using the Web Crypto API.

**Dependencies:** Milestone 07 (Rich Text Editor), Milestone 04 (Authentication)

---

## Architecture Impact

### Backend
- Private diaries stored as `encrypted_data` blob (opaque to the server)
- `content_html` and `content_text` are absent for private diaries (server never has plaintext)
- Privacy filter on all diary queries: private diaries are excluded from public listings, search, and random selection
- Validation: if `privacy: "private"`, require `encrypted_data` and reject `content_html`
- Master key management: store `encrypted_master_key` and `master_key_salt` on the user document
- Password change: re-encrypt master key with new password-derived key
- Password reset: clear `encrypted_master_key` and `master_key_salt` (irrecoverable data loss)
- No decryption endpoints — the client must not send the master key to the server

### Frontend
- `crypto.ts` module: Web Crypto API wrapper for all encryption operations
- Master key: generated once on first private diary creation, encrypted with password-derived key, stored on server
- Per-diary keys: derived from master key + random salt via HKDF, used for AES-256-GCM
- Editor: when privacy is "private", encrypt title + content + tags before calling save
- Reader: fetch diary, decrypt in browser, render content
- Diary list: decrypt titles client-side for list display (with loading states)
- Privacy selector widget in settings panel: Public / Private / Draft with explanations
- Password change flow: re-encrypts master key client-side before calling password change API
- Password reset: shows data loss warning about private diaries being unrecoverable

### Database
- `diaries` collection: private diaries store `encrypted_data` (BSON binary), no `content_html`, no `content_text`
- `users` collection: two new fields — `encrypted_master_key` (hex string), `master_key_salt` (hex string)
- No new collections

### API
- No new endpoints — diary CRUD handles private diaries through field validation
- Change password endpoint updated to accept `new_encrypted_master_key` and `new_master_key_salt`
- Password reset endpoint clears master key fields

### Search
- Private diaries excluded from Meilisearch indexing (M10) at the query level
- Tags from private diaries excluded from tag aggregation

### Security
- True end-to-end encryption: server never sees plaintext content
- Master key encrypted with Argon2id-derived key (not bcrypt/PBKDF2)
- Per-diary unique salt prevents content correlation via ciphertext analysis
- AES-256-GCM provides authenticated encryption (tampering detected)
- Master key never leaves the client unencrypted
- Password change re-encrypts, doesn't decrypt, the master key

---

## Features

### F8.1 — Crypto Utilities Module (Frontend)

**File:** `frontend/src/lib/crypto.ts`

```typescript
// ============================================================
// Web Crypto API wrapper for DiaryArchive E2E encryption
// ============================================================

// --- Key Derivation ---

/**
 * Derive a 256-bit key from password + salt using PBKDF2.
 * (Argon2id is not available in Web Crypto; PBKDF2 with 600k iterations is the fallback.
 *  In production, use @aspect-build/argon2 or a WASM Argon2id module.)
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- Master Key ---

/**
 * Generate a new 256-bit AES master key.
 * Called once when user creates their first private diary.
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable (needed for encryption/decryption)
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Encrypt the master key with a password-derived key.
 * The result (wrapped key + salt) is stored on the server.
 */
export async function encryptMasterKey(
  masterKey: CryptoKey,
  password: string
): Promise<{ encryptedMasterKey: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await deriveKeyFromPassword(password, salt);
  const wrappedKey = await crypto.subtle.wrapKey('raw', masterKey, passwordKey, { name: 'AES-GCM' });
  return {
    encryptedMasterKey: bufferToHex(wrappedKey),
    salt: bufferToHex(salt),
  };
}

/**
 * Decrypt the master key using the user's password.
 */
export async function decryptMasterKey(
  encryptedMasterKey: string,
  salt: string,
  password: string
): Promise<CryptoKey> {
  const saltBytes = hexToBuffer(salt);
  const passwordKey = await deriveKeyFromPassword(password, saltBytes);
  return crypto.subtle.unwrapKey(
    'raw',
    hexToBuffer(encryptedMasterKey),
    passwordKey,
    { name: 'AES-GCM' },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- Per-Diary Key Derivation ---

/**
 * Derive a per-diary AES-256-GCM key from the master key + diary salt.
 * Uses HKDF-SHA256 for key derivation.
 */
export async function deriveDiaryKey(
  masterKey: CryptoKey,
  diarySalt: Uint8Array
): Promise<CryptoKey> {
  const keyData = await crypto.subtle.exportKey('raw', masterKey);
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      salt: diarySalt,
      info: new TextEncoder().encode('diaryarchive-diary-key-v1'),
      hash: 'SHA-256',
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- Diary Encryption ---

export interface DiaryPlaintext {
  title: string;
  contentHtml: string;
  tags: string[];
}

export interface DiaryEncryptedPayload {
  ciphertext: string; // hex-encoded AES-256-GCM output
  iv: string;         // hex-encoded 12-byte IV
  salt: string;       // hex-encoded 16-byte per-diary salt
}

/**
 * Encrypt a diary entry: serialize plaintext, generate salt + IV,
 * derive diary key from master key, encrypt with AES-256-GCM.
 */
export async function encryptDiary(
  plaintext: DiaryPlaintext,
  masterKey: CryptoKey
): Promise<DiaryEncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const diaryKey = await deriveDiaryKey(masterKey, salt);
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    diaryKey,
    encoder.encode(JSON.stringify(plaintext))
  );
  return {
    ciphertext: bufferToHex(new Uint8Array(ciphertext)),
    iv: bufferToHex(iv),
    salt: bufferToHex(salt),
  };
}

/**
 * Decrypt a diary entry: extract salt + IV, derive diary key,
 * decrypt ciphertext, parse JSON.
 */
export async function decryptDiary(
  payload: DiaryEncryptedPayload,
  masterKey: CryptoKey
): Promise<DiaryPlaintext> {
  const salt = hexToBuffer(payload.salt);
  const iv = hexToBuffer(payload.iv);
  const diaryKey = await deriveDiaryKey(masterKey, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    diaryKey,
    hexToBuffer(payload.ciphertext)
  );
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext));
}

// --- Helpers ---

function bufferToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
```

### F8.2 — Master Key Lifecycle (Frontend)

**File:** `frontend/src/hooks/use-master-key.ts`

```typescript
interface MasterKeyState {
  masterKey: CryptoKey | null;
  isLoading: boolean;
  error: string | null;
}
```

Lifecycle:
1. **On first private diary creation:** Call `generateMasterKey()`, encrypt with password via `encryptMasterKey()`, store `encryptedMasterKey` and `salt` on user profile via `PUT /users/me/encryption-key`
2. **On app load (if user has encryptedMasterKey):** Prompt for password (if not already in session memory), derive password key, unwrap master key. Store master key in React state (not persisted).
3. **On logout:** Clear master key from React state (no persistence possible — master key is only in memory).
4. **On password change (F8.11):** Re-encrypt existing master key with new password, send new `encryptedMasterKey` + `salt` alongside the password change request.
5. **On password reset (F8.12):** Server clears `encryptedMasterKey` + `salt`. User is warned that private diaries are lost.

### F8.3 — Private Diary Storage (Backend)

**File:** `backend/app/services/diary_service.py` (updated)

Private diary validation on create:
```python
async def create_diary(self, user_id: str, data: DiaryCreateRequest) -> Diary:
    if data.privacy == "private":
        if not data.encrypted_data:
            raise ValidationException("encrypted_data is required for private diaries")
        if data.content_html:
            raise ValidationException("content_html must be absent for private diaries")
        if data.content_text:
            raise ValidationException("content_text must be absent for private diaries")
    # ... else existing public/draft creation logic
```

Private diary validation on update:
```python
async def update_diary(self, diary_id: str, user_id: str, data: DiaryUpdateRequest) -> Diary:
    existing = await self.repo.find_by_id(diary_id)
    if existing["privacy"] != data.privacy:
        # Prevent changing privacy between private and non-private
        raise ValidationException("Privacy level cannot be changed between private and non-private")
    # ... proceed with update
```

### F8.4 — Privacy Filter on Queries (Backend)

**File:** `backend/app/repositories/diary_repo.py` (updated)

All public-facing queries include:
```python
{"privacy": {"$ne": "private"}}
```

Specific queries:
- `find_public_feed`: `{"privacy": "public"}` (unchanged, drafts are already excluded, private added)
- `find_random`: `{"privacy": "public"}` (unchanged)
- `find_by_id`: Allow access to private only if `user_id == owner_id`; return 404 to others
- `find_user_diaries` (other user's page): `{"privacy": "public", "user_id": owner_id}`
- `find_my_diaries` (own page): No privacy filter (owner sees all)

### F8.5 — Encrypted Data Schema (Backend)

**File:** `backend/app/models/diary.py` (updated)

```python
class EncryptedData(BaseModel):
    ciphertext: str  # hex-encoded
    iv: str          # hex-encoded
    salt: str        # hex-encoded

class DiaryCreateRequest(BaseModel):
    privacy: Privacy  # "public" | "draft" | "private"
    title: Optional[str] = None  # required if public/draft, absent if private
    content_html: Optional[str] = None
    content_text: Optional[str] = None
    encrypted_data: Optional[EncryptedData] = None  # required if private
    tags: list[str] = []
    emotion: Optional[str] = None
    comments_enabled: bool = True
```

### F8.6 — Editor Private Mode (Frontend)

**File:** `frontend/src/components/editor/editor-settings.tsx` (updated)

When privacy selector is set to "Private":
1. Show explanation panel: "This diary will be end-to-end encrypted. The server cannot read its contents. Encryption happens in your browser before the data is sent."
2. If user has no master key yet, trigger key generation flow (F8.2) before first save
3. On save, call `encryptDiary(plaintext, masterKey)` before calling the API
4. The `encrypted_data` object is sent instead of `content_html`/`content_text`
5. Title input shows a small lock icon to indicate title is encrypted too

### F8.7 — Private Diary Reader (Frontend)

**File:** `frontend/src/app/(main)/diary/[id]/page.tsx` (updated)

Additional flow for private diaries:
1. Fetch diary by ID
2. If `privacy === "private"`, check master key is loaded
3. If master key not loaded, show password prompt overlay (inline, not a redirect)
4. On password submit, decrypt master key, then decrypt diary
5. Show decrypted title, content, tags
6. Show "End-to-end encrypted" badge near the privacy badge
7. Handle decryption failure (wrong password / corrupted data): show error message with "The diary cannot be decrypted. This may happen if your password has changed since this diary was created."

### F8.8 — Private Diary List Items (Frontend)

**File:** `frontend/src/components/diary/diary-card.tsx` (updated)

On `/me` (my diaries) page:
- Private diaries show: "Encrypted diary" as title placeholder (until decrypted)
- Decrypt title in batch: iterate visible private diaries, decrypt titles using loaded master key
- Show loading state while decrypting ("Decrypting...")
- Show lock icon on the card
- On failed decryption: show "Unable to decrypt — [Learn why]" with tooltip

### F8.9 — Privacy Selector Widget (Frontend)

**File:** `frontend/src/components/editor/privacy-selector.tsx`

Radio-style selector with clear explanation for each option:

```
◉ Public
  Anyone can read this diary. It will appear on the homepage and in search results.

○ Private
  End-to-end encrypted. Only you can read it. The server cannot see the content.
  [!] Requires a master key. This diary cannot be recovered if you lose your password.

○ Draft
  Only you can see it. Not encrypted. Useful for works-in-progress.
```

- Visual: each option is a card-like row with radio button, label, description, and icon
- Private option shows a lock icon
- Private option is disabled if the user has no master key generated yet (with "Set up encryption" action)
- Privacy change between public/private/draft is not allowed after creation (F8.3)

### F8.10 — Master Key Generation UX (Frontend)

When user selects "Private" privacy for the first time:
1. Show dialog: "Set up end-to-end encryption"
2. Explanation: "Your diary content will be encrypted in your browser before being sent to the server. A master encryption key will be generated and stored (encrypted with your password) on our servers."
3. Warning: "If you lose your password and have no recovery email, your private diaries cannot be recovered. There is no backdoor."
4. "Generate Key" button
5. On click: generate master key, encrypt with password, store on server via API call
6. On success: show confirmation, close dialog, proceed with private diary creation

### F8.11 — Password Change with Key Re-encryption (Frontend)

**File:** `frontend/src/app/(main)/settings/page.tsx` (updated)

Extended password change flow:
1. User enters current password + new password
2. Client-side: decrypt master key with current password
3. Client-side: re-encrypt master key with new password
4. Send to server: `{ current_password, new_password, new_encrypted_master_key, new_master_key_salt }`
5. Server verifies current password, updates password hash, stores new encrypted master key + salt
6. If user has no master key, skip steps 2-4 (standard password change)

### F8.12 — Password Reset with Data Loss Warning (Frontend)

**File:** `frontend/src/app/(auth)/reset-password/page.tsx` (updated)

Password reset flow:
1. User submits reset token + new password
2. If user has `encrypted_master_key`, show warning: "You have private diaries that are encrypted with your old password. After resetting, these diaries will be unrecoverable. [Cancel] [I understand, reset anyway]"
3. On confirmation: server clears `encrypted_master_key` and `master_key_salt` fields, sets new password hash
4. On next login: user has no master key — private diaries cannot be decrypted (UI shows them as "unavailable")

---

## File Structure

### New Files (Frontend)
```
frontend/src/
├── lib/
│   └── crypto.ts                           # Web Crypto API wrapper (all encryption primitives)
├── hooks/
│   └── use-master-key.ts                   # Master key lifecycle management
└── components/
    └── editor/
        └── privacy-selector.tsx             # Privacy selector widget with explanations
```

### Modified Files (Frontend)
```
frontend/src/
├── app/(main)/
│   ├── diary/
│   │   ├── [id]/page.tsx                   # Decrypt + display private diaries
│   │   └── [id]/edit/page.tsx              # Handle encrypted save for private diaries
│   ├── me/page.tsx                         # Decrypt titles for private diary list
│   └── settings/page.tsx                   # Password change with key re-encryption
├── app/(auth)/
│   └── reset-password/page.tsx             # Data loss warning for private diary owners
├── components/
│   ├── diary/diary-card.tsx                # Show "Encrypted" placeholder for private
│   ├── diary/diary-card-list.tsx           # Decrypt batch private diary titles
│   └── editor/editor-settings.tsx          # Wire privacy selector, encrypt on save
├── hooks/
│   └── use-diaries.ts                     # Add decrypt step to diary queries
└── store/
    └── diary-store.ts                      # Add master key reference
```

### Modified Files (Backend)
```
backend/app/
├── api/v1/endpoints/
│   ├── users.py                            # Add encryption key management endpoint
│   ├── diaries.py                          # Private diary validation in CRUD
│   └── auth.py                             # Password change with key re-encryption, reset clears keys
├── services/
│   ├── diary_service.py                    # Private diary validation logic
│   └── user_service.py                     # Encryption key storage
└── repositories/
    └── diary_repo.py                       # Privacy filter on all public queries
```

---

## Database Changes

### Modified Collections

**`users` collection — new fields:**
```javascript
{
  encrypted_master_key: String | null,  // hex-encoded wrapped master key
  master_key_salt: String | null,       // hex-encoded salt for password-derived key
}
```

**`diaries` collection — private diary document:**
```javascript
{
  privacy: "private",
  // title, content_html, content_text: ABSENT (never stored)
  encrypted_data: {
    ciphertext: Binary,  // AES-256-GCM output stored as BSON binary
    iv: String,          // hex-encoded IV
    salt: String,        // hex-encoded per-diary salt
  },
  tags: [],              // tags are NOT encrypted (needed for search)
  emotion: String | null,
  user_id: ObjectId,
  created_at: Date,
  updated_at: Date,
  // published_at: ABSENT (private diaries are never "published")
  year: Number,
  month: Number,
  stats: { like_count: 0, comment_count: 0, bookmark_count: 0 },
  comments_enabled: false
}
```

### New Indexes
```javascript
// No new indexes — existing indexes are sufficient
// Private diaries are excluded from all public queries via filter, not separate index
```

### Migrations
```javascript
// Add fields to users collection
db.users.updateMany(
  { encrypted_master_key: { $exists: false } },
  { $set: { encrypted_master_key: null, master_key_salt: null } }
);
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/users/me/encryption-key` | Bearer | Store/replace encrypted master key and salt |
| POST | `/diaries` | Bearer | Create diary (accepts `encrypted_data` for private) |
| PUT | `/diaries/{id}` | Bearer | Update diary (private diaries accept `encrypted_data`) |
| PUT | `/auth/change-password` | Bearer | Password change with optional key re-encryption |
| POST | `/auth/reset-password` | None | Password reset (clears master key if exists) |

### Encryption Key Request
```json
PUT /api/v1/users/me/encryption-key
{
  "encrypted_master_key": "ab12cd34...",
  "master_key_salt": "ef56gh78..."
}
```

### Encryption Key Response
```json
{
  "data": {
    "has_master_key": true,
    "message": "Encryption key stored successfully."
  }
}
```

### Create Private Diary Request
```json
{
  "privacy": "private",
  "encrypted_data": {
    "ciphertext": "aabbccdd...",
    "iv": "11223344...",
    "salt": "55667788..."
  },
  "tags": ["life", "reflection"],
  "emotion": "peaceful",
  "comments_enabled": false
}
```

### Private Diary Response (to owner only)
```json
{
  "data": {
    "id": "665a2b3c4d5e6f7a8b9c0d1e",
    "privacy": "private",
    "encrypted_data": {
      "ciphertext": "aabbccdd...",
      "iv": "11223344...",
      "salt": "55667788..."
    },
    "tags": ["life", "reflection"],
    "emotion": "peaceful",
    "stats": { "like_count": 0, "comment_count": 0, "bookmark_count": 0 },
    "is_owner": true,
    "created_at": "2026-06-25T09:00:00Z",
    "updated_at": "2026-06-25T09:00:00Z"
  }
}
```

### Password Change with Key Re-encryption
```json
PUT /api/v1/auth/change-password
{
  "current_password": "OldPass123",
  "new_password": "NewPass456",
  "new_encrypted_master_key": "ab12cd34...",
  "new_master_key_salt": "ef56gh78..."
}
```

---

## Frontend

### Pages
- `/diary/[id]` — Updated: decrypts and displays private diaries with password prompt if no master key in memory
- `/diary/[id]/edit` — Updated: encrypts content before save for private diaries
- `/me` — Updated: decrypts private diary titles in list with loading states
- `/settings` — Updated: password change includes key re-encryption step
- `/reset-password` — Updated: shows data loss warning for users with private diaries

### Components
- `PrivacySelector` — Three-option radio card with explanations, icon, and master key setup flow
- `TiptapEditor` — Updated: encrypts content before save when privacy=private
- `DiaryCard` — Updated: shows "Encrypted diary" placeholder, lock icon, decrypt-in-progress skeleton
- `DiaryCardList` — Updated: batch decrypt private diary titles on /me page

### Hooks
- `useMasterKey()` — Load/decrypt master key from server, manage lifecycle (load on app startup, clear on logout)
- `useDiary(id)` — Updated: decrypt private diary content after fetching
- `useMyDiaries()` — Updated: decrypt titles in list

### State Management
- `diary-store.ts` — Add `masterKey` reference (CryptoKey is not serializable, stored in React state)
- `auth-store.ts` — Add `hasMasterKey` boolean (derived from user.encrypted_master_key presence)

### Routing
- Private diary reader: no special routing; access control enforced server-side (404 for non-owners)
- Password reset: warning dialog prevents accidental data loss; user must explicitly confirm

### Accessibility
- Privacy selector options are `<label>`-wrapped radio inputs with clear descriptions
- Lock icon on private diary cards has `aria-label="End-to-end encrypted"`
- Password prompt overlay for private diary reading has focus trap, Escape to dismiss
- Decryption failure: error message announced via `aria-live="polite"`
- "Encrypted" badge uses accessible color (does not rely solely on color — includes lock icon)
- Loading skeleton for decryption has `aria-label="Decrypting diary content"`

### Responsive Design
- Privacy selector: cards stack vertically on all viewports (consistent UX)
- Password prompt overlay: centered modal, full-screen on mobile with backdrop
- Decrypted title display: same layout as public diary, no differences in responsive behavior
- Encryption key setup dialog: full-width on mobile, max-w-md centered on desktop

---

## Backend

### Services
- `diary_service.py` (updated): Private diary validation, privacy immutability enforcement
- `user_service.py` (updated): Encryption key storage, re-encryption during password change
- `auth_service.py` (updated): Master key clearing on password reset

### Business Logic

**Create private diary:**
1. Validate `privacy === "private"` → require `encrypted_data`, reject `content_html`/`content_text`
2. Validate `encrypted_data` shape (ciphertext, iv, salt present)
3. Set `published_at: null` (private diaries are never published)
4. Set `comments_enabled: false` (private diaries cannot have comments)
5. Insert diary document with `encrypted_data` stored as-is
6. Do NOT increment `stats.diary_count` (stat only counts published diaries)
7. Return diary ID

**Update private diary:**
1. Verify existing diary is also private (no privacy change allowed)
2. If `encrypted_data` provided, replace existing blob
3. If tags provided, update tags (tags are not encrypted — they enable search/filter)
4. Return updated diary

**Privacy filter on public feed:**
1. Add `{"privacy": {"$ne": "private"}}` to all public listing queries
2. Add same filter to tag aggregation, random diary, and search
3. Owner can fetch their own private diaries by ID

**Password change with master key:**
1. Verify current password
2. Hash new password
3. If `new_encrypted_master_key` and `new_master_key_salt` provided, update user fields
4. Revoke all refresh tokens
5. Return success

**Password reset:**
1. Verify token
2. Hash new password
3. Set `encrypted_master_key: null`, `master_key_salt: null`
4. Return success

### Repositories
- `diary_repo.py` (updated): Privacy-aware query methods, private diary exclusion

### Background Workers
- None specific to encryption. Private diaries are subject to the same TTL/stale cleanup as drafts if they are older than 7 days and still in draft/private state without meaningful content (debatable — typically private diaries are not auto-deleted).

---

## Security

### Authentication
- All private diary mutations require valid Bearer token
- Reading private diaries requires owner authentication (server returns 404 to others)

### Authorization
- Owner-only access to private diaries at the database query level
- `encrypted_master_key` can only be set/changed by the authenticated user (same as profile update)
- No admin backdoor: admins cannot read private diary content (only see `encrypted_data` blob + tags)

### Encryption Architecture
- Algorithm: AES-256-GCM (authenticated encryption — detects tampering)
- Key derivation: PBKDF2 with 600,000 iterations (Web Crypto limitation; Argon2id via WASM in future)
- Per-diary key: HKDF-SHA256 from master key + random 16-byte salt
- IV: 12 random bytes per diary (AES-GCM recommended IV size)
- Master key: 256-bit AES key, wrapped with password-derived key, stored on server
- Server never receives plaintext master key or plaintext diary content
- Tags are intentionally NOT encrypted (they enable browsing and filtering)
- Emotion is intentionally NOT encrypted (same reason)

### OWASP
- Cryptographic storage: AES-256-GCM is NIST-approved, widely vetted
- Key management: Master key encrypted at rest on server (with user's password), decrypted in browser only
- Data integrity: GCM provides authentication tag — tampered ciphertext fails to decrypt
- Weak password: PBKDF2 iterations slow brute-force; 600k iterations = ~500ms on modern hardware
- Session management: Master key cleared on logout; password change re-encrypts rather than decrypts
- Insecure direct object reference (IDOR): Private diary access check at query level, not just response

### Limitations
- Tags and emotion are not encrypted. If this is a concern, future milestone could add a separate encrypted tags blob.
- Diary metadata (created_at, updated_at, stats) is not encrypted (needed for queries).
- The server knows you have a private diary and its size. Content is protected.

---

## Performance

- Encryption/decryption is client-side — zero server overhead
- PBKDF2 with 600k iterations takes ~500ms on modern browsers (acceptable for login / first private diary read per session)
- Per-diary HKDF derivation is fast (~5ms)
- AES-256-GCM encrypts/decrypts at ~100 MB/s on modern hardware (diary content is typically <100KB — sub-millisecond)
- Master key is cached in browser memory for the session (no repeated PBKDF2)
- Batch title decryption on /me page: uses `Promise.all` for parallel decryption of visible diaries
- Server queries filter private diaries at the query level using indexes (no application-level filtering)

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_create_private_diary` | Unit | Creates private diary with encrypted_data, no content_html |
| `test_create_private_diary_no_encrypted_data` | Unit | Missing encrypted_data returns 422 |
| `test_create_private_diary_with_content_html` | Unit | Present content_html returns 422 |
| `test_private_diary_excluded_from_public_feed` | Unit | Private diary not in GET /diaries |
| `test_private_diary_excluded_from_random` | Unit | Private diary not in GET /diaries/random |
| `test_private_diary_owner_can_read` | Unit | Owner GET returns encrypted_data |
| `test_private_diary_non_owner_404` | Unit | Non-owner GET returns 404 |
| `test_private_diary_update_owner` | Unit | Owner can update encrypted_data |
| `test_private_diary_cannot_change_privacy` | Unit | Changing private→public or vice versa returns 422 |
| `test_master_key_storage` | Unit | PUT /users/me/encryption-key stores key |
| `test_master_key_overwrite` | Unit | Replacing master key succeeds |
| `test_password_change_reencrypts_key` | Unit | Password change stores new encrypted_master_key |
| `test_password_reset_clears_key` | Unit | Password reset nullifies master key fields |
| `test_tags_still_visible_on_private` | Unit | Private diary tags are stored and returned |
| `test_private_diary_no_published_at` | Unit | Private diary has null published_at |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| Crypto deriveKeyFromPassword | Unit | Returns CryptoKey with correct algorithm |
| Crypto encryptDiary + decryptDiary | Unit | Round-trip: plaintext → ciphertext → plaintext |
| Crypto decryptDiary wrong key | Unit | Fails gracefully with error |
| Crypto decryptDiary tampered | Unit | Tampered ciphertext throws error |
| Crypto encryptMasterKey + decryptMasterKey | Unit | Round-trip: master key → wrapped → unwrapped |
| useMasterKey loads on init | Unit | Loads and decrypts master key from server on app start |
| Private diary reader with stored key | Integration | Decrypts and displays content |
| Private diary reader without key | Integration | Shows password prompt overlay |
| Private diary card shows lock | Unit | Card renders lock icon for private diaries |
| Private diary title decryption in list | Integration | Batch decrypts titles on /me page |
| Privacy selector renders | Unit | Three options with descriptions render |
| Password change with re-encryption | Integration | Re-encrypts master key and sends to server |
| Password reset shows warning | Integration | Warning dialog appears for users with master key |
| Master key generation dialog | Integration | Full flow: generate → encrypt → store → confirm |

---

## Documentation

- `docs/api.md` — Update with encryption key endpoint, private diary request/response schemas
- `docs/architecture.md` — Add E2E encryption data flow diagram
- `docs/security.md` — Document encryption architecture, threat model, key management
- `docs/milestones/milestone-08.md` — This document
- `docs/diary-encryption/SKILL.md` — Encryption skill reference

---

## Acceptance Criteria

1. A user can create a private diary. The server stores only `encrypted_data` — `content_html` and `content_text` are absent from the database document.
2. Private diaries do not appear in the public feed, random diary, or any public listing.
3. A user who is not the owner receives 404 when accessing a private diary by ID.
4. The owner can read their private diary: content is decrypted and rendered in the browser.
5. Opening a private diary without the master key in memory shows a password prompt.
6. Diary titles in "My Diaries" list are decrypted and displayed for private diaries.
7. The privacy selector widget clearly explains Public, Draft, and Private options.
8. Setting a diary to private for the first time triggers the master key generation flow.
9. Changing the password re-encrypts the master key; private diaries remain accessible after the change.
10. Resetting the password (forgot password flow) clears the master key and shows a data loss warning.
11. Tags from private diaries are visible in the API response (not encrypted) but excluded from public tag aggregation.
12. Tags and emotion are still filterable for private diaries (owner only).
13. Private diaries have `comments_enabled: false` and cannot receive comments.
14. All encryption tests pass (`make test`).
15. Verifying the database directly shows ciphertext, not plaintext content.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| PBKDF2 is not Argon2id (Web Crypto limitation) | High | Use WASM-based Argon2id module in future; PBKDF2 with 600k iterations is still strong |
| User loses password — private diaries lost forever | Medium | Clear warning during setup; email recovery does NOT recover master key (by design) |
| Master key generation fails in old browsers | Low | Check `window.crypto.subtle` availability; show error page for unsupported browsers |
| Encryption performance on low-end mobile | Low | PBKDF2 takes ~1s; cache master key; per-diary derivation is fast |
| Timing side-channel on master key presence | Low | `/auth/me` always returns `has_master_key` for authenticated users (no timing difference) |
| Ciphertext length reveals content length | Low | Pad encrypted payload to fixed block sizes (future optimization) |
| Tags leak private diary existence | Medium | Tags are encrypted in M09+; for M08, tags are not encrypted (accept this trade-off) |

---

## Future Considerations

- Milestone 10 adds Meilisearch indexing — private diaries are explicitly excluded from search indexes.
- Milestone 11 notifications: private diaries are excluded from notification triggers (no likes, comments, follows on private diaries).
- Milestone 14 performance: add content padding to hide plaintext length, upgrade to WASM Argon2id.
- Tags encryption: a future milestone can add an `encrypted_tags` field for complete content privacy, with server-side search replaced by client-side filtering after batch decryption.
- Key recovery: a future milestone could support a recovery key (separate from password) stored encrypted with a recovery phrase — user opt-in.
- Multi-device: master key export/import between devices using QR code or encrypted file transfer.
- Admin moderation: private diaries are inherently unmoderatable. If abuse reporting is needed, users can report tags/title metadata only.
