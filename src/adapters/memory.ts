import type { StorageAdapter, PersistedFlagEntry } from "../types";

// Module-level storage for memory adapter
const storage = new Map<string, PersistedFlagEntry>();

/**
 * Create an in-memory adapter
 * Useful for SSR and testing - data is lost on page refresh
 */
export function memoryAdapter(): StorageAdapter {
  return {
    isAvailable(): boolean {
      return true; // Always available
    },

    get(key: string): PersistedFlagEntry | undefined {
      const entry = storage.get(key);
      if (!entry) return undefined;

      // TTL check
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        storage.delete(key);
        return undefined;
      }

      return entry;
    },

    set(key: string, entry: PersistedFlagEntry): void {
      storage.set(key, entry);
    },

    remove(key: string): void {
      storage.delete(key);
    },
  };
}
