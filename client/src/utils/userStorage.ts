const PREFIX = "souschef:v1:";
const LEGACY_KEYS = ["selectedRecipeIds"];

interface Envelope<T> {
  v: 1;
  savedAt: number;
  data: T;
}

export function storageKey(
  userId: string | number,
  feature: string,
  id = "",
): string {
  return `${PREFIX}${userId}:${feature}${id ? `:${id}` : ""}`;
}

/** Read a value; returns null when missing, expired, malformed, or storage is unavailable. */
export function readStored<T>(key: string, maxAgeMs?: number): T | null {
  try {
    const text = localStorage.getItem(key);
    if (!text) return null;
    const parsed = JSON.parse(text) as Envelope<T>;
    if (!parsed || parsed.v !== 1) return null;
    if (maxAgeMs !== undefined && Date.now() - parsed.savedAt > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/** Write a value; returns false when storage is full, disabled, or the value cannot be serialized. */
export function writeStored<T>(key: string, data: T): boolean {
  try {
    const envelope: Envelope<T> = { v: 1, savedAt: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable; nothing to remove
  }
}

/** Remove every key this app owns for any user. Called on logout. */
export function clearAllUserData(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(PREFIX) || LEGACY_KEYS.includes(key)))
        doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch {
    // storage unavailable; nothing to clear
  }
}
