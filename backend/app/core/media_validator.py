ALLOWED_MIME_TYPES: dict[str, set[bytes]] = {
    "image/jpeg": {b"\xff\xd8\xff"},
    "image/png": {b"\x89PNG\r\n\x1a\n"},
    "image/webp": {b"RIFF"},
    "image/gif": {b"GIF87a", b"GIF89a"},
    "image/avif": {b"ftyp"},
    "video/mp4": {b"ftyp"},
    "video/webm": {b"\x1aE\xdf\xa3"},
    "audio/mpeg": {b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xe3", b"ID3"},
    "audio/ogg": {b"OggS"},
    "audio/wav": {b"RIFF"},
    "audio/mp4": {b"ftyp"},
}

MAX_FILE_SIZES: dict[str, int] = {
    "image": 10 * 1024 * 1024,
    "video": 50 * 1024 * 1024,
    "audio": 30 * 1024 * 1024,
}

MAX_WIDTH = 8000
MAX_HEIGHT = 8000
MAX_PIXELS = 64_000_000


def detect_mime_type(data: bytes) -> str | None:
    if len(data) < 8:
        return None

    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"

    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"

    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"

    stripped = data.lstrip()
    if stripped.startswith((b"<?xml", b"<svg", b"<html", b"<!DOCTYPE")):
        return None

    if data[:4] == b"RIFF":
        if len(data) >= 12 and data[8:12] == b"WEBP":
            return "image/webp"
        if len(data) >= 12 and data[8:12] == b"WAVE":
            return "audio/wav"
        return None

    if data[:4] == b"\x1aE\xdf\xa3":
        return "video/webm"

    if data[:4] == b"OggS":
        return "audio/ogg"

    if data[:3] == b"ID3":
        return "audio/mpeg"

    if data[0] == 0xFF and (data[1] & 0xE0) == 0xE0:
        return "audio/mpeg"

    if len(data) >= 12 and data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand == b"avif":
            return "image/avif"
        if brand in (b"mp42", b"isom", b"M4V ", b"avc1", b"iso2", b"mp41"):
            return "video/mp4"
        if brand in (b"M4A ", b"M4B "):
            return "audio/mp4"

    return None


def is_allowed_mime(mime: str) -> bool:
    return mime in ALLOWED_MIME_TYPES


def mime_category(mime: str) -> str:
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    return "other"


def get_max_size(mime: str) -> int:
    category = mime_category(mime)
    return MAX_FILE_SIZES.get(category, 0)
