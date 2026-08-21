// Module-scoped cache of in-memory master keys (non-extractable CryptoKeys),
// keyed by user id. Kept in its own module so both the master-key hook and the
// auth store can clear it without introducing a circular dependency.
//
// P3.2: Keys are automatically cleared after a configurable inactivity period
// (default 15 minutes) to limit the window of exposure if the device is left
// unlocked. A timer is reset every time a key is accessed or set.

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  key: CryptoKey;
  timer: ReturnType<typeof setTimeout>;
}

const masterKeyMap = new Map<string, CacheEntry>();

function _resetTimer(userId: string): void {
  const entry = masterKeyMap.get(userId);
  if (!entry) return;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    masterKeyMap.delete(userId);
    // Clear the CryptoKey handle (best-effort; non-extractable keys can't be
    // zeroized in JS, but removing the reference allows GC).
  }, INACTIVITY_TIMEOUT_MS);
}

export function getMasterKey(userId: string): CryptoKey | undefined {
  const entry = masterKeyMap.get(userId);
  if (!entry) return undefined;
  _resetTimer(userId);
  return entry.key;
}

export function setMasterKey(userId: string, key: CryptoKey): void {
  // Clear any existing entry first.
  const existing = masterKeyMap.get(userId);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    masterKeyMap.delete(userId);
  }, INACTIVITY_TIMEOUT_MS);
  masterKeyMap.set(userId, { key, timer });
}

export function clearMasterKey(userId: string): void {
  const entry = masterKeyMap.get(userId);
  if (entry) {
    clearTimeout(entry.timer);
    masterKeyMap.delete(userId);
  }
}

export function clearAllMasterKeys(): void {
  for (const entry of masterKeyMap.values()) {
    clearTimeout(entry.timer);
  }
  masterKeyMap.clear();
}
