// ============================================================
// Web Crypto API wrapper for DiaryArchive E2E encryption
// ============================================================
//
// Key hierarchy:
//   password --> PBKDF2 --> passwordKey (non-extractable)
//   masterBytes (32 random bytes) --encrypted with passwordKey--> stored server-side
//   masterBytes --imported as non-extractable HKDF baseKey--> masterKey
//   masterKey --HKDF(salt)--> per-diary AES-GCM key
//
// The in-memory `masterKey` is non-extractable, so an XSS compromise cannot
// call `crypto.subtle.exportKey` to exfiltrate it. The raw master bytes are
// only materialised transiently during setup / load / password change and are
// never held by normal diary encryption/decryption paths.

// --- Key Derivation ---

export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 600000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// --- Master Key ---

const MASTER_KEY_BYTES = 32;

export function generateMasterKey(): Uint8Array {
  const bytes = new Uint8Array(MASTER_KEY_BYTES);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function importMasterKey(masterBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    masterBytes as BufferSource,
    "HKDF",
    false,
    ["deriveKey"]
  );
}

export async function encryptMasterKey(
  masterBytes: Uint8Array,
  password: string
): Promise<{ encryptedMasterKey: string; salt: string; iv: string }> {
  const salt = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(iv);
  const passwordKey = await deriveKeyFromPassword(password, salt);
  const wrappedKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    passwordKey,
    masterBytes as BufferSource
  );
  return {
    encryptedMasterKey: bufferToHex(wrappedKey),
    salt: bufferToHex(salt),
    iv: bufferToHex(iv),
  };
}

export async function decryptMasterKey(
  encryptedMasterKey: string,
  salt: string,
  iv: string,
  password: string
): Promise<Uint8Array> {
  const saltBytes = hexToBuffer(salt);
  const ivBytes = hexToBuffer(iv);
  const passwordKey = await deriveKeyFromPassword(password, saltBytes);
  const plainBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes as BufferSource },
    passwordKey,
    hexToBuffer(encryptedMasterKey) as BufferSource
  );
  return new Uint8Array(plainBytes);
}

// --- Per-Diary Key Derivation ---

async function deriveDiaryKey(
  masterKey: CryptoKey,
  diarySalt: Uint8Array
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      salt: diarySalt as BufferSource,
      info: new TextEncoder().encode("diaryarchive-diary-key-v1"),
      hash: "SHA-256",
    },
    masterKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// --- Diary Encryption ---

export interface DiaryPlaintext {
  title: string;
  contentHtml: string;
  tags: string[];
}

export interface DiaryEncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}

export async function encryptDiary(
  plaintext: DiaryPlaintext,
  masterKey: CryptoKey
): Promise<DiaryEncryptedPayload> {
  const salt = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(iv);
  const diaryKey = await deriveDiaryKey(masterKey, salt);
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    diaryKey,
    encoder.encode(JSON.stringify(plaintext))
  );
  return {
    ciphertext: bufferToHex(new Uint8Array(ciphertext)),
    iv: bufferToHex(iv),
    salt: bufferToHex(salt),
  };
}

export async function decryptDiary(
  payload: DiaryEncryptedPayload,
  masterKey: CryptoKey
): Promise<DiaryPlaintext> {
  const salt = hexToBuffer(payload.salt);
  const iv = hexToBuffer(payload.iv);
  const diaryKey = await deriveDiaryKey(masterKey, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    diaryKey,
    hexToBuffer(payload.ciphertext) as BufferSource
  );
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext));
}

// --- Helpers ---

function bufferToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): Uint8Array {
  const len = hex.length / 2;
  const buf = new ArrayBuffer(len);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// P3.3: Sensitive byte zeroization.
// Fills a Uint8Array with zeros to prevent stale key material from lingering
// in memory. JS engines may optimize away zeroization of unreachable buffers,
// but it is still best practice as a defense-in-depth measure.

export function zeroize(bytes: Uint8Array): void {
  if (bytes && bytes.length > 0) {
    bytes.fill(0);
  }
}

/** Convenience: zeroize the hex-decoded form of a string. */
export function zeroizeHex(hex: string): Uint8Array {
  const buf = hexToBuffer(hex);
  return buf; // caller should zeroize(buf) when done
}