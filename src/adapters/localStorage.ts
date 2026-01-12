import type { StorageAdapter, PersistedFlagEntry } from "../types";

/**
 * Create a localStorage adapter
 * Each flag is stored as a separate key in localStorage
 */
export function localStorageAdapter(): StorageAdapter {
  return {
    isAvailable(): boolean {
      if (typeof window === "undefined") return false;
      try {
        const testKey = "__flipflag_test__";
        window.localStorage.setItem(testKey, "test");
        window.localStorage.removeItem(testKey);
        return true;
      } catch {
        return false;
      }
    },

    get(key: string): PersistedFlagEntry | undefined {
      if (!this.isAvailable()) return undefined;

      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return undefined;

        const entry = JSON.parse(raw) as PersistedFlagEntry;

        // TTL check
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          this.remove(key);
          return undefined;
        }

        return entry;
      } catch {
        // Corrupted data, remove it
        this.remove(key);
        return undefined;
      }
    },

    set(key: string, entry: PersistedFlagEntry): void {
      if (!this.isAvailable()) return;

      try {
        const serialized = JSON.stringify(entry);
        window.localStorage.setItem(key, serialized);
      } catch (e) {
        // Storage quota exceeded or other error
        console.warn("[FlipFlag Persist] Failed to save to localStorage:", e);
      }
    },

    remove(key: string): void {
      if (!this.isAvailable()) return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore removal errors
      }
    },
  };
}
