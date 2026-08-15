import base64
import hashlib
import hmac
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _get_email_aesgcm() -> AESGCM:
    key = bytes.fromhex(settings.email_encryption_key)
    if len(key) != 32:
        raise ValueError("EMAIL_ENCRYPTION_KEY must be 32 bytes (64 hex chars)")
    return AESGCM(key)


def encrypt_email(email: str) -> str:
    aesgcm = _get_email_aesgcm()
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, email.encode(), None)
    return base64.b64encode(nonce + ciphertext).decode()


def decrypt_email(encrypted: str) -> str:
    aesgcm = _get_email_aesgcm()
    raw = base64.b64decode(encrypted)
    nonce = raw[:12]
    ciphertext = raw[12:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode()


def _email_hmac_key() -> bytes:
    """Keyed HMAC secret derived from the server-side encryption key.

    Using a keyed hash (rather than raw SHA-256) prevents dictionary /
    rainbow-table attacks on leaked email hashes.
    """
    return bytes.fromhex(settings.email_encryption_key)


def hash_email(email: str) -> str:
    """Keyed (HMAC-SHA256) email hash for equality lookups.

    Format: "v2:<hex>". Versioned so a future algorithm change can be migrated
    cleanly. Existing legacy (raw SHA-256) values are still recognized on lookup
    via `legacy_email_hash`.
    """
    key = _email_hmac_key()
    digest = hmac.new(key, email.lower().strip().encode(), hashlib.sha256).hexdigest()
    return f"v2:{digest}"


def legacy_email_hash(email: str) -> str:
    """Legacy raw SHA-256 hash, kept only for migrating existing records."""
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()


def matches_email_hash(email: str, stored_hash: str | None) -> bool:
    """Return True if the normalized email matches a stored email hash.

    Accepts the current keyed format ("v2:...") and legacy raw SHA-256 so
    records created before the keyed-hash change remain resolvable.
    """
    if not stored_hash:
        return False
    normalized = email.lower().strip()
    if stored_hash.startswith("v2:"):
        return hmac.compare_digest(stored_hash, hash_email(normalized))
    return hmac.compare_digest(stored_hash, legacy_email_hash(normalized))
