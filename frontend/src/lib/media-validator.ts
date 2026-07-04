const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/mp4",
];

const MAX_FILE_SIZES: Record<string, number> = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateMediaFile(file: File): ValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type || "unknown"}" is not supported. Allowed: JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MP3, OGG, WAV.`,
    };
  }

  const category = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
        ? "audio"
        : null;

  if (category) {
    const maxSize = MAX_FILE_SIZES[category];
    if (file.size > maxSize) {
      const sizeMb = (maxSize / (1024 * 1024)).toFixed(0);
      return {
        valid: false,
        error: `File exceeds maximum size of ${sizeMb} MB for ${category} files.`,
      };
    }
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: "File is empty.",
    };
  }

  return { valid: true };
}

export function validateImageFile(file: File): ValidationResult {
  const baseResult = validateMediaFile(file);
  if (!baseResult.valid) return baseResult;

  if (!file.type.startsWith("image/")) {
    return {
      valid: false,
      error: "Only image files can be inserted into diaries.",
    };
  }

  return { valid: true };
}
