// Module-scoped cache of in-memory master keys (non-extractable CryptoKeys),
// keyed by user id. Kept in its own module so both the master-key hook and the
// auth store can clear it without introducing a circular dependency.

const masterKeyMap = new Map<string, CryptoKey>();

export function getMasterKey(userId: string): CryptoKey | undefined {
  return masterKeyMap.get(userId);
}

export function setMasterKey(userId: string, key: CryptoKey): void {
  masterKeyMap.set(userId, key);
}

export function clearMasterKey(userId: string): void {
  masterKeyMap.delete(userId);
}

export function clearAllMasterKeys(): void {
  masterKeyMap.clear();
}