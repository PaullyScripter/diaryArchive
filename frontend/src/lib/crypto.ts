// ============================================================
// Web Crypto API wrapper for DiaryArchive E2E encryption
// ============================================================

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
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

// --- Master Key ---

export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

export async function encryptMasterKey(
  masterKey: CryptoKey,
  password: string
): Promise<{ encryptedMasterKey: string; salt: string; iv: string }> {
  const salt = new Uint8Array(new ArrayBuffer(16));
  crypto.getRandomValues(salt);
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(iv);
  const passwordKey = await deriveKeyFromPassword(password, salt);
  const wrappedKey = await crypto.subtle.wrapKey(
    "raw",
    masterKey,
    passwordKey,
    { name: "AES-GCM", iv: iv as BufferSource }
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
): Promise<CryptoKey> {
  const saltBytes = hexToBuffer(salt);
  const ivBytes = hexToBuffer(iv);
  const passwordKey = await deriveKeyFromPassword(password, saltBytes);
  return crypto.subtle.unwrapKey(
    "raw",
    hexToBuffer(encryptedMasterKey) as BufferSource,
    passwordKey,
    { name: "AES-GCM", iv: ivBytes as BufferSource },
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// --- Per-Diary Key Derivation ---

async function deriveDiaryKey(
  masterKey: CryptoKey,
  diarySalt: Uint8Array
): Promise<CryptoKey> {
  const keyData = await crypto.subtle.exportKey("raw", masterKey);
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      salt: diarySalt as BufferSource,
      info: new TextEncoder().encode("diaryarchive-diary-key-v1"),
      hash: "SHA-256",
    },
    hkdfKey,
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

function toBuf(bytes: Uint8Array): Uint8Array {
  const buf = new ArrayBuffer(bytes.length);
  const copy = new Uint8Array(buf);
  copy.set(bytes);
  return copy;
}
