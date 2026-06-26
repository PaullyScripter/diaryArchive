# Milestone 13 — Media System

## Overview

**Goal:** Users can upload images and other media to include in their diaries. The system handles file validation, optimization, secure storage, and cleanup.

**Purpose:** Media enriches diary entries with images, making them more expressive and engaging. Without this milestone, diaries are text-only. Media upload also powers avatar uploads, and the MinIO infrastructure enables future file attachment features.

**Dependencies:** Milestone 06 (Public Diaries), Milestone 07 (Rich Text Editor), Milestone 04 (Authentication)

---

## Architecture Impact

### Backend
- New MinIO client service for async S3-compatible object storage (upload, download, delete, presigned URLs)
- Image processing pipeline: generates WebP thumbnails (150px) and standard-size (1200px) variants using Pillow
- MIME type validation using magic bytes (`python-magic` or `filetype`), not file extension
- UUID-based file naming to prevent collision and path traversal
- Private media URL signing with short-lived presigned URLs (15-minute expiry)
- Cascade delete: when a diary is deleted, all associated media records are cleaned up
- Media metadata stored in new `media` MongoDB collection
- Referential integrity: media records link to user_id and optional diary_id

### Frontend
- Tiptap image extension with drag-and-drop, paste, and file picker support
- Upload progress bar visible during upload
- In-editor image resize handles (adjustable width)
- Image gallery modal for browsing previously uploaded images
- Client-side file type and size validation before upload

### Database
- New `media` collection: stores file metadata, user_id, diary_id, variants, content_type, size
- New indexes for efficient queries and cascade operations

### API
- 3 new endpoints: POST upload, DELETE media, GET signed URL
- File upload limited to 10MB per file, 20MB per request

### Security
- MIME validation by magic bytes (not extension) prevents disguised executables
- UUID filenames prevent path traversal
- Signed URLs prevent unauthorized access to private media
- Upload rate limiting prevents storage abuse
- Virus scanning placeholder for future integration

---

## Features

### F13.1 — MinIO Client Service (Backend)

**File:** `backend/app/services/minio_service.py`

Async MinIO client with connection pooling, retry logic, and bucket management.

```python
from minio import Minio
from minio.error import S3Error
from app.core.config import settings

class MinioService:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self.bucket_public = settings.MINIO_BUCKET_PUBLIC
        self.bucket_private = settings.MINIO_BUCKET_PRIVATE

    async def ensure_buckets(self):
        for bucket in [self.bucket_public, self.bucket_private]:
            if not self.client.bucket_exists(bucket):
                self.client.make_bucket(bucket)

    async def upload(self, bucket: str, object_name: str, data: bytes, content_type: str):
        result = self.client.put_object(
            bucket, object_name, io.BytesIO(data), len(data),
            content_type=content_type,
        )
        return result.object_name

    async def delete(self, bucket: str, object_name: str):
        self.client.remove_object(bucket, object_name)

    async def get_presigned_url(self, bucket: str, object_name: str, expires: int = 900):
        return self.client.presigned_get_object(bucket, object_name, expires=expires)
```

- `ensure_buckets()`: called on app startup, creates `media-public` and `media-private` buckets
- `upload()`: returns object_name (including path prefix)
- `delete()`: removes single object
- `delete_prefix()`: removes all objects under a prefix (used for cascade delete)
- `get_presigned_url()`: generates presigned GET URL with configurable expiry

### F13.2 — Image Optimization Service (Backend)

**File:** `backend/app/services/image_service.py`

Image processing pipeline using Pillow:

```python
from PIL import Image
import io

THUMBNAIL_SIZE = (150, 150)
STANDARD_SIZE = (1200, 1200)
ALLOWED_FORMATS = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"}

async def process_image(data: bytes, content_type: str) -> dict:
    """Generate thumbnail and standard-size WebP variants."""
    original = Image.open(io.BytesIO(data))
    original = original.convert("RGB")  # Remove alpha for WebP

    variants = {}
    # Original as WebP (optimized)
    buf_original = io.BytesIO()
    original.save(buf_original, "WEBP", quality=85, method=6)
    variants["original"] = buf_original.getvalue()

    # Thumbnail (150px)
    thumb = original.copy()
    thumb.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
    buf_thumb = io.BytesIO()
    thumb.save(buf_thumb, "WEBP", quality=80, method=6)
    variants["thumbnail"] = buf_thumb.getvalue()

    # Standard (1200px max dimension)
    if max(original.size) > STANDARD_SIZE[0]:
        standard = original.copy()
        standard.thumbnail(STANDARD_SIZE, Image.LANCZOS)
    else:
        standard = original.copy()
    buf_standard = io.BytesIO()
    standard.save(buf_standard, "WEBP", quality=85, method=6)
    variants["standard"] = buf_standard.getvalue()

    return variants
```

- Always converts to WebP for browser compatibility and smaller file size
- Preserves EXIF orientation metadata during processing
- Thumbnail: 150px max dimension, quality 80
- Standard: 1200px max dimension, quality 85
- Original in WebP: quality 85
- GIF files: preserve animation by saving as GIF (not WebP) for thumbnail only
- All variants stored in MinIO with suffix: `_thumbnail.webp`, `_standard.webp`

### F13.3 — MIME Type Validation (Backend)

**File:** `backend/app/core/validators.py`

Validate files by magic bytes, not extension:

```python
import filetype

ALLOWED_MIME_TYPES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF", b"WEBP"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/avif": [b"\x00\x00\x00\x20\x66\x74\x79\x70\x61\x76\x69\x66"],
    "image/tiff": [b"II*\x00", b"MM\x00*"],
    "image/bmp": [b"BM"],
}

def validate_mime_type(data: bytes) -> str:
    kind = filetype.guess(data)
    if kind is None or kind.mime not in ALLOWED_MIME_TYPES:
        raise InvalidMediaTypeError(f"Unsupported file type: {kind.mime if kind else 'unknown'}")
    return kind.mime
```

### F13.4 — Size Validation (Backend)

```python
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_TOTAL_SIZE = 20 * 1024 * 1024  # 20 MB per request (multiple files future)

def validate_file_size(data: bytes):
    if len(data) > MAX_FILE_SIZE:
        raise FileTooLargeError(f"File exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)}MB")
```

### F13.5 — Media Upload Endpoint (Backend)

**File:** `backend/app/api/v1/endpoints/media.py`

POST /api/v1/media/upload

- Auth: Bearer required
- Content-Type: multipart/form-data
- File field: `file` (single file, required)
- Optional field: `diary_id` (associate with a diary)
- Flow:
  1. Validate content length (from Content-Length header or chunked reading)
  2. Read file bytes into memory
  3. Validate MIME type by magic bytes
  4. Validate file size
  5. Generate UUID-based filename: `{uuid}.{ext}` — but stored as `.webp`
  6. Process image: generate thumbnail + standard variants
  7. Upload all variants to MinIO (public bucket for public diaries, private bucket for private)
  8. Create media document in MongoDB
  9. If diary_id provided, verify diary exists and user has permission
  10. Add media reference to diary's media array
  11. Return media response with URLs

```python
@router.post("/upload", status_code=201)
async def upload_media(
    file: UploadFile = File(...),
    diary_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    media_service: MediaService = Depends(get_media_service),
):
    data = await file.read()
    content_type = validate_mime_type(data)
    validate_file_size(data)
    result = await media_service.create_media(
        user_id=current_user.id,
        data=data,
        content_type=content_type,
        diary_id=diary_id,
        filename=file.filename,
    )
    return {"data": result}
```

### F13.6 — Media Delete Endpoint (Backend)

DELETE /api/v1/media/{id}

- Auth: Bearer required
- Authorization: must be media owner or admin
- Flow:
  1. Find media by ID
  2. Verify ownership (or admin)
  3. Delete all variants from MinIO
  4. Remove media reference from associated diary
  5. Delete media document from MongoDB
  6. Return 204

### F13.7 — Private Media URL Signing (Backend)

GET /api/v1/media/{id}/url

- Auth: Bearer required
- Authorization: must be diary owner or diary is public
- Flow:
  1. Find media by ID
  2. If associated diary is private, verify requesting user owns the diary
  3. Generate presigned GET URL (15-minute expiry)
  4. Return signed URL

### F13.8 — Media Cleanup on Diary Delete (Backend)

**File:** `backend/app/services/media_service.py`

Extended in `diary_service.py`:

When a diary is deleted:
1. Query all media records with matching `diary_id`
2. For each media record, delete all variants from MinIO
3. Delete all media documents from MongoDB
4. Continue with diary deletion (comments, likes, bookmarks, diary itself)

```python
async def cascade_delete_diary_media(diary_id: str):
    media_records = await media_repo.find_by_diary(diary_id)
    for media in media_records:
        prefix = f"users/{media.user_id}/{media.id}"
        await minio_service.delete_prefix("media-public", prefix)
        await minio_service.delete_prefix("media-private", prefix)
    await media_repo.delete_by_diary(diary_id)
```

### F13.9 — Media Repository (Backend)

**File:** `backend/app/repositories/media_repo.py`

```python
class MediaRepository(BaseRepository):
    collection_name = "media"

    async def create(self, media: MediaCreate) -> Media:
        doc = media.model_dump()
        doc["created_at"] = datetime.utcnow()
        result = await self.collection.insert_one(doc)
        return await self.get_by_id(str(result.inserted_id))

    async def find_by_diary(self, diary_id: str) -> list[Media]:
        cursor = self.collection.find({"diary_id": ObjectId(diary_id)}).sort("created_at", -1)
        return [self._to_model(doc) async for doc in cursor]

    async def find_by_user(self, user_id: str, page: int = 1, per_page: int = 20) -> tuple[list[Media], int]:
        query = {"user_id": ObjectId(user_id)}
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("created_at", -1).skip((page-1)*per_page).limit(per_page)
        items = [self._to_model(doc) async for doc in cursor]
        return items, total

    async def delete(self, media_id: str):
        result = await self.collection.delete_one({"_id": ObjectId(media_id)})
        return result.deleted_count > 0

    async def delete_by_diary(self, diary_id: str):
        await self.collection.delete_many({"diary_id": ObjectId(diary_id)})
```

### F13.10 — Gallery Endpoint (Backend)

GET /api/v1/media?page=1&per_page=20

- Auth: Bearer required
- Returns user's uploaded media (paginated)
- Each item: id, thumbnail_url, original_url, content_type, file_size, created_at, diary_id
- Response: `{ data: [...], meta: { page, per_page, total, has_next, has_prev } }`

### F13.11 — Image Upload Plugin for Tiptap (Frontend)

**File:** `frontend/src/components/editor/extensions/image-upload.ts`

Custom Tiptap extension that handles:

```typescript
import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageUpload: {
      setImageUpload: () => ReturnType;
    };
  }
}

export const ImageUpload = Extension.create({
  name: "imageUpload",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("imageUpload"),
        props: {
          handleDOMEvents: {
            drop(view, event) {
              const hasFiles = event.dataTransfer?.files?.length;
              if (!hasFiles) return false;
              const images = Array.from(event.dataTransfer.files).filter(
                (f) => f.type.startsWith("image/")
              );
              if (images.length === 0) return false;
              event.preventDefault();
              const pos = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              images.forEach((image) => uploadAndInsert(image, pos?.pos));
              return true;
            },
            paste(view, event) {
              const items = event.clipboardData?.items;
              if (!items) return false;
              const images = Array.from(items).filter(
                (i) => i.type.startsWith("image/")
              );
              if (images.length === 0) return false;
              event.preventDefault();
              images.forEach((item) => {
                const file = item.getAsFile();
                if (file) uploadAndInsert(file);
              });
              return true;
            },
          },
        },
      }),
    ];
  },
});
```

- Drag-and-drop: captures drop event, gets the drop position, uploads and inserts image at cursor
- Paste: captures paste event, extracts image files from clipboard, uploads and inserts
- File picker toolbar button: opens native file picker, uploads selected files

### F13.12 — Upload Progress Component (Frontend)

**File:** `frontend/src/components/editor/upload-progress.tsx`

```typescript
interface UploadProgressProps {
  progress: number; // 0-100
  fileName: string;
  status: "uploading" | "processing" | "complete" | "error";
  error?: string;
}
```

- Progress bar: animated fill from 0-100%
- Status text: "Uploading..." → "Processing..." → "Complete" or "Upload failed"
- Error state: red bar with error message and "Try again" button
- Multiple concurrent uploads shown as stacked progress items
- Auto-dismiss on completion after 2 seconds

### F13.13 — In-Editor Image Resize (Frontend)

**File:** `frontend/src/components/editor/extensions/resizable-image.ts`

Custom Tiptap node extension for resizable images:

```typescript
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (el) => el.getAttribute("width") || "100%",
        renderHTML: (attrs) => ({ width: attrs.width }),
      },
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") || "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
    };
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement("div");
      container.className = "relative inline-block group";
      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.width = node.attrs.width;
      img.className = "rounded-md";
      // Resize handle
      const handle = document.createElement("div");
      handle.className = "absolute bottom-0 right-0 w-3 h-3 cursor-se-resize bg-primary opacity-0 group-hover:opacity-100";
      container.appendChild(img);
      container.appendChild(handle);
      return { dom: container };
    };
  },
});
```

- Drag handle in bottom-right corner for resizing
- Presets in toolbar: "Small" (33%), "Medium" (66%), "Full width" (100%)
- Width stored as attribute on the image node
- Click to select, drag handle to resize proportionally
- Double-click image to open viewer modal

### F13.14 — Image Gallery Modal (Frontend)

**File:** `frontend/src/components/editor/image-gallery.tsx`

Modal that displays user's previously uploaded images:

- Triggered by "Browse Gallery" button in editor toolbar
- Grid layout: 3-column thumbnail grid
- Each thumbnail: 150x150px, click to insert at cursor position
- Pagination: "Load More" at bottom
- Loading state: skeleton thumbnails
- Empty state: "No images uploaded yet"
- Search/filter: filter by filename or date (basic)
- Insert behavior: adds image node at current cursor position with standard variant URL

### F13.15 — Client-Side File Validation (Frontend)

**File:** `frontend/src/lib/media/validation.ts`

```typescript
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "image/gif", "image/avif", "image/tiff", "image/bmp",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `Unsupported file type: ${file.type}` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large: ${(file.size / (1024*1024)).toFixed(1)}MB (max 10MB)` };
  }
  return { valid: true };
}
```

- Runs before upload (avoids wasted upload bandwidth)
- Checks file.type against allowlist
- Checks file.size against limit
- Shows inline error toast if validation fails
- Image dimensions validated client-side (min 32px, max 8000px on any side)

---

## File Structure

### New Files (Backend)
```
backend/app/
├── api/v1/endpoints/
│   └── media.py                       # Upload, delete, gallery, signed URL endpoints
├── core/
│   └── validators.py                  # MIME type validation by magic bytes, size validation
├── models/
│   └── media.py                       # MediaCreate, MediaResponse, MediaInDB Pydantic models
├── repositories/
│   └── media_repo.py                  # CRUD for media collection
├── services/
│   ├── image_service.py               # Image processing: thumbnail, standard, WebP conversion
│   ├── media_service.py               # Media business logic: create, delete, cascade
│   └── minio_service.py               # MinIO async client: upload, download, delete, presigned URLs
```

### Modified Files (Backend)
```
backend/app/api/v1/router.py           # Include media router
backend/app/main.py                    # Initialize MinIO buckets on startup
backend/app/services/diary_service.py  # Cascade delete media on diary delete
backend/pyproject.toml                 # Add Pillow, python-magic/filetype, minio dependencies
```

### New Files (Frontend)
```
frontend/src/
├── app/(main)/
│   └── media/
│       └── page.tsx                   # User's media gallery page
├── components/
│   └── editor/
│       ├── extensions/
│       │   ├── image-upload.ts        # Tiptap extension for drag-drop/paste upload
│       │   └── resizable-image.ts     # Tiptap node extension for resizable images
│       ├── image-gallery.tsx          # Browse uploaded images modal
│       └── upload-progress.tsx        # Upload progress bar component
├── hooks/
│   ├── use-media.ts                   # TanStack Query hooks for media upload/list/delete
│   └── use-upload.ts                  # Upload mutation with progress tracking
└── lib/
    └── media/
        ├── validation.ts              # Client-side file type/size validation
        └── upload.ts                  # Upload helper with fetch + XMLHttpRequest progress
```

### Modified Files (Frontend)
```
frontend/src/components/editor/tiptap-editor.tsx  # Register image upload/resizable extensions
frontend/src/components/editor/toolbar.tsx        # Add image upload button, gallery button
frontend/package.json                             # Add tiptap extension deps if needed
```

---

## Database Changes

### New Collection: `media`

```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "diary_id": "ObjectId | null",
  "original_filename": "string",
  "storage_path": "string (UUID-based path, e.g. users/{user_id}/{media_id}/{variant})",
  "content_type": "string (MIME type of original)",
  "file_size": "int (bytes, original)",
  "variants": {
    "original": {"path": "string", "size": 102400, "width": 1920, "height": 1080},
    "thumbnail": {"path": "string", "size": 5120, "width": 150, "height": 150},
    "standard": {"path": "string", "size": 25600, "width": 1200, "height": 675}
  },
  "width": "int",
  "height": "int",
  "is_private": "bool",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Indexes

| Collection | Index | Purpose |
|-----------|-------|---------|
| `media` | `{ user_id: 1, created_at: -1 }` | Gallery queries (list by user, newest first) |
| `media` | `{ diary_id: 1 }` | Cascade delete on diary removal |
| `media` | `{ user_id: 1, diary_id: 1 }` | Compound lookup for diary media |
| `media` | `{ created_at: -1 }` | Admin media browsing, cleanup |

### Migrations
- Create `media` collection on application startup (via `createIndexes` in main.py)
- Add `media_count` or `has_media` field to `diaries` collection schema (optional optimization)
- Existing diary documents: no migration needed (media reference is additive)

---

## API Endpoints

| Method | Path | Auth | Rate Limit | Request | Response |
|--------|------|------|-----------|---------|----------|
| POST | `/media/upload` | Bearer | 30/min | `multipart/form-data: file + diary_id?` | `{ data: { id, variants, created_at } }` |
| DELETE | `/media/{id}` | Bearer | 60/min | — | 204 No Content |
| GET | `/media/{id}/url` | Bearer | 120/min | — | `{ data: { url, expires_at } }` |
| GET | `/media` | Bearer | 60/min | `?page=1&per_page=20` | `{ data: [...], meta: {...} }` |
| GET | `/media/{id}` | Bearer | 60/min | — | `{ data: { full media record } }` |

### Upload Response

```json
{
  "data": {
    "id": "665a3b4c5d6e7f8a9b0c1d2e",
    "variants": {
      "thumbnail": "https://minio.example.com/media-public/users/abc/thumb_150x150.webp",
      "standard": "https://minio.example.com/media-public/users/abc/standard_1200x.webp",
      "original": "https://minio.example.com/media-public/users/abc/original.webp"
    },
    "content_type": "image/jpeg",
    "file_size": 2048576,
    "width": 1920,
    "height": 1080,
    "created_at": "2026-06-25T10:30:00Z"
  }
}
```

### Signed URL Response

```json
{
  "data": {
    "url": "https://minio.example.com/media-private/...?X-Amz-Algorithm=...&X-Amz-Credential=...&X-Amz-Expires=900",
    "expires_at": "2026-06-25T10:45:00Z"
  }
}
```

---

## Frontend

### Pages
- `/media` — User's media gallery with thumbnail grid, pagination, delete functionality

### Editor Integration
- Tiptap toolbar gets 3 new buttons: Upload Image (file picker), Gallery (browse modal), Image Settings (alignment, size, link)
- Drag-and-drop zone: entire editor area accepts drops, highlights on dragover
- Paste handler: pasted images from clipboard are uploaded inline
- Upload progress shown as a floating indicator above the editor

### Components
- `UploadProgress` — Animated progress bar for each concurrent upload
- `ImageGallery` — Modal grid of user's uploaded images with insert action
- `ResizableImage` — Tiptap node view with drag-resize handle and alignment controls

### Hooks
- `useUpload()` — Mutation with progress callback:
  ```typescript
  function useUpload() {
    return useMutation({
      mutationFn: async ({ file, diaryId, onProgress }: UploadArgs) => {
        const formData = new FormData();
        formData.append("file", file);
        if (diaryId) formData.append("diary_id", diaryId);
        return apiClient.post("/media/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => onProgress?.(Math.round((e.loaded / e.total) * 100)),
        });
      },
    });
  }
  ```
- `useMediaGallery(page)` — TanStack Query for paginated media list
- `useDeleteMedia()` — TanStack Query mutation with cache invalidation
- `useMediaUrl(id)` — TanStack Query for presigned URL (for private media)

### State Management
- Upload queue stored in local component state (not global store)
- Media gallery fetched via TanStack Query with cache
- Current image selection in gallery modal managed via useState

### Accessibility
- Upload area announces "drop files here" via aria-label
- Progress bar uses `role="progressbar"` with `aria-valuenow`
- Gallery thumbnails have descriptive alt text (original filename)
- Keyboard: Enter/Space on gallery thumbnails inserts image
- Keyboard: Escape closes gallery modal
- Focus returns to the trigger button when gallery modal closes
- Image resize handles are focusable, adjustable with arrow keys

### Responsive Design
- Gallery grid: 4-column (desktop) → 3-column (tablet) → 2-column (mobile)
- Upload progress indicator: full-width bar on mobile, floating on desktop
- Image in editor: max-width 100%, height auto on mobile (full-width)
- Gallery modal: full-screen on mobile (<640px), centered dialog on desktop

---

## Backend

### Services

**`MediaService`:**
- `create_media()`: orchestrates validation → processing → upload → DB insert
- `delete_media()`: orchestrates MinIO delete → DB delete → diary reference removal
- `get_signed_url()`: owner check → presigned URL generation
- `get_user_media()`: paginated gallery query
- `get_media_by_id()`: single record lookup

**`ImageService`:**
- `process_image()`: validates, generates variants, returns byte arrays
- `get_image_dimensions()`: extracts width/height from bytes

**`MinioService`:**
- `ensure_buckets()`: idempotent bucket creation
- `upload()`, `delete()`, `delete_prefix()`, `get_presigned_url()`

### Business Logic

**Upload flow:**
1. Receive multipart upload with file and optional diary_id
2. Read entire file into memory (up to 10MB — acceptable for images)
3. Validate MIME type by magic bytes → 415 if unsupported
4. Validate file size → 413 if too large
5. Generate UUID v4 for the media record
6. Process image: create thumbnail (150px), standard (1200px), and original WebP variants
7. Determine bucket: public (no diary or diary is public) vs private (diary is private)
8. Upload each variant to MinIO with path `users/{user_id}/{media_id}/{variant}.webp`
9. If diary_id provided: verify diary exists and user has write access
10. Create media document in MongoDB
11. If diary_id provided: push media reference to diary's `media_ids` array
12. Return media response with variant URLs

**Delete flow:**
1. Find media by ID → 404 if not found
2. Verify ownership (current user is uploader) or admin → 403 if unauthorized
3. Remove all variant files from MinIO
4. Remove media reference from parent diary (if linked)
5. Delete media document from MongoDB
6. Return 204

**Signed URL flow (private media):**
1. Find media by ID → 404 if not found
2. If media is linked to a private diary: verify current user is diary owner → 403 if not
3. If media is public or linked to public diary: allow access
4. Generate presigned GET URL with 15-minute expiry
5. Return URL + expiry timestamp

**Cascade delete on diary removal:**
1. Query all media records where `diary_id == diary_to_delete`
2. For each media record:
   a. Delete all variants from MinIO (both public and private buckets)
   b. Delete media document
3. Proceed with diary document deletion

### Repositories
- `MediaRepository`: `create`, `find_by_id`, `find_by_diary`, `find_by_user` (paginated), `delete`, `delete_by_diary`

### Background Workers
- `cleanup_orphaned_media` — Periodic task (daily) that finds media records where `diary_id` points to a deleted diary and removes them. Run as a Celery task or APScheduler job.
- `cleanup_expired_signed_urls` — No cleanup needed (presigned URLs are stateless, no server-side tracking)

---

## Security

### Authentication
- All media endpoints require valid Bearer access token
- Anonymous upload is not permitted (prevents storage abuse)

### Authorization
- Users can only delete their own media (or admin can delete any)
- Private diary media is only accessible to the diary owner (signed URL with access check)
- Public diary media is accessible to anyone (but URLs still expire to prevent hotlinking)

### Privacy
- Media linked to private diaries is stored in `media-private` bucket (access controlled via signed URLs)
- Media linked to public diaries is stored in `media-public` bucket (but still UUID-named, preventing enumeration)
- Media not linked to any diary follows the uploader's default privacy setting
- Uploader info stored in media record for audit trail

### OWASP
- File upload validation: MIME type checked by magic bytes (not extension) — prevents disguised executables
- Path traversal: UUID-based filenames with no user-controlled path components — prevents directory traversal
- Size limits: 10MB per file, 20MB per request — prevents storage DoS
- Content-Type: server sets Content-Type from validated MIME, not from upload — prevents MIME confusion
- Rate limiting: 30 uploads/min per user — prevents upload DoS
- Image bombs: Pillow has built-in decompression bomb protection (`Image.MAX_IMAGE_PIXELS` set to 178M)
- EXIF stripping: EXIF data removed during WebP conversion — prevents location/metadata leakage
- CSRF: All mutating endpoints require Bearer token (not cookie-only)
- Signed URLs: short-lived (15min), scoped to specific object

---

## Performance

- Image processing uses Pillow in-memory (no temp files) — fast for images up to 10MB
- Variants generated sequentially (acceptable at expected scale <10 uploads/sec)
- MinIO upload is async — does not block the event loop
- Media gallery queries use index on `{ user_id: 1, created_at: -1 }` — sub-millisecond
- Presigned URL generation is O(1) — no server-side state needed
- Thumbnails (150px) used in gallery listings — significantly less bandwidth than originals
- Standard variant (1200px) used in diary reader — balances quality and load time

### Caching
- Media URLs from gallery response are cacheable (CDN cache for public variants)
- Signed private URLs are not cached (short expiry, per-request)
- User's media list can be cached for 30 seconds (redis) since uploads are infrequent

### Image Sizes
| Variant | Max Dimension | Quality | Typical Size |
|---------|---------------|---------|-------------|
| thumbnail | 150px | 80 | 3-8 KB |
| standard | 1200px | 85 | 20-80 KB |
| original | Original | 85 (webp) | 50-300 KB |

---

## Testing

### Backend Tests

| Test | Type | Description |
|------|------|-------------|
| `test_upload_image_jpeg` | Unit | JPEG upload returns 201 with variant URLs |
| `test_upload_image_png` | Unit | PNG upload validates and converts to WebP |
| `test_upload_image_webp` | Unit | WebP upload passes through |
| `test_upload_unsupported_mime` | Unit | SVG/PDF returns 415 |
| `test_upload_invalid_magic_bytes` | Unit | Renamed .exe with .jpg extension returns 415 |
| `test_upload_file_too_large` | Unit | File >10MB returns 413 |
| `test_upload_with_diary_id` | Unit | Media linked to diary creates reference |
| `test_upload_private_diary_media` | Unit | Private diary media stored in private bucket |
| `test_delete_media_owner` | Unit | Owner can delete, files removed from MinIO |
| `test_delete_media_non_owner` | Unit | Non-owner receives 403 |
| `test_delete_media_admin` | Unit | Admin can delete any media |
| `test_signed_url_public` | Unit | Public media returns URL without auth check |
| `test_signed_url_private_owner` | Unit | Private media returns URL for diary owner |
| `test_signed_url_private_non_owner` | Unit | Private media returns 403 for non-owner |
| `test_gallery_pagination` | Unit | Returns paginated results |
| `test_cascade_delete_on_diary_removal` | Integration | Deleting diary removes all associated media |
| `test_thumbnail_generation` | Unit | Thumbnail is 150px max dimension |
| `test_standard_variant_generation` | Unit | Standard is 1200px max dimension |
| `test_variant_content_type` | Unit | All variants are image/webp |
| `test_mime_validation_edge_cases` | Unit | Empty file, partial header, GIF animation |

### Frontend Tests

| Test | Type | Description |
|------|------|-------------|
| Upload progress bar | Unit | Progress updates from 0 to 100 |
| Upload completion | Unit | Progress bar dismisses after success |
| Upload error state | Unit | Error shows message and retry button |
| Client-side validation | Unit | Invalid file types rejected before network request |
| Client-side size validation | Unit | Files >10MB rejected before network request |
| Drag-and-drop upload | Unit | Dropped image triggers upload |
| Paste image upload | Unit | Pasted image triggers upload |
| Image gallery renders | Unit | Thumbnails display in grid |
| Image gallery empty | Unit | Empty state shows "No images" message |
| Image gallery pagination | Unit | "Load More" fetches next page |
| Image resize handle | Unit | Dragging handle changes node width attribute |
| Image alignment buttons | Unit | Clicking alignment changes data-align attribute |
| Gallery modal accessibility | Unit | Keyboard navigation, focus management |
| Multiple concurrent uploads | Unit | Each upload tracked independently |

---

## Documentation

- `docs/api.md` — Update with media endpoints, request/response schemas, error codes
- `docs/milestones/milestone-13.md` — This document
- `docs/architecture.md` — Update storage architecture with MinIO details
- `README.md` — Add MinIO setup instructions for development

---

## Acceptance Criteria

1. A user can upload a JPEG/PNG/WebP image via the editor toolbar button.
2. A user can drag-and-drop an image onto the editor to upload and insert it.
3. A user can paste an image from the clipboard into the editor to upload and insert it.
4. Upload progress is shown as a visual bar during the upload.
5. The uploaded image renders inline in the diary content at standard size (1200px).
6. The image can be resized within the editor via drag handle or presets (33%, 66%, 100%).
7. Uploading a file with an unsupported MIME type (e.g., SVG, PDF) shows a client-side error.
8. Renaming a .exe to .jpg and uploading it is rejected server-side by magic byte validation.
9. Files larger than 10MB are rejected with a clear error message.
10. A user can browse their uploaded images in the gallery modal and insert one into the editor.
11. Media linked to a public diary is publicly accessible via its URL.
12. Media linked to a private diary requires a signed URL; the server verifies diary ownership.
13. Deleting a diary removes all associated media from MinIO and the database.
14. A user can delete their own media from the gallery.
15. Non-owners cannot delete or access private media.
16. All thumbnails are 150px WebP images generated from the original.
17. All media tests pass (`make test`).

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Image bomb decompression | Low | Pillow MAX_IMAGE_PIXELS set to 178M; reject images exceeding 8000px on any side |
| MinIO connection failure | Low | Retry logic in MinioService; health check on startup; fallback to local filesystem in dev |
| Storage exhaustion | Low | Per-user rate limit (30 uploads/min); file size limit (10MB); storage quota per user in future |
| Malicious file disguised as image | Low | Magic byte validation (not extension); strip EXIF data; AV scanning in future |
| Presigned URL leakage | Medium | 15-minute expiry; access verification on each URL generation (not on URL access) |
| Concurrent upload race | Low | UUID naming avoids collisions; per-user rate limit prevents flood |
| Orphaned media after diary delete | Low | Cascade delete in transaction; background cleanup job as safety net |

---

## Future Considerations

- Milestone 14 adds image CDN caching and WebP AVIF fallback based on Accept headers.
- User avatars currently stored as URL strings — Migrate to MinIO upload using this milestone's infrastructure.
- Video/audio upload support (extend MIME allowlist, generate poster frames for video).
- Client-side image compression before upload for large files (Canvas API resize).
- AI-powered image moderation (NSFW detection, content moderation).
- EXIF GPS data stripping as an optional privacy feature.
- Image captions and alt text editing in the editor.
- Drag-to-reorder images within diary content.
- Storage quota per user with admin overrides and upgrade prompts.
