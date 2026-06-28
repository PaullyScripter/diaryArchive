import base64
import hashlib
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


def hash_email(email: str) -> str:
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()
