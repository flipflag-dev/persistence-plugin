import type { FlipFlag } from "@flipflag/sdk";
import type { PersistenceOptions, StorageAdapter, PersistedFlagEntry } from "./types";
import { localStorageAdapter } from "./adapters/localStorage";
import { sessionStorageAdapter } from "./adapters/sessionStorage";
import { cookieAdapter } from "./adapters/cookie";
import type { CookieAdapterOptions } from "./types";

const DEFAULT_PREFIX = "flipflag:";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Wrap a FlipFlag instance with persistence
 * Proxies isEnabled() to persist and restore flag values
 */
export function withPersistence<T extends FlipFlag>(
  flipFlag: T,
  options: PersistenceOptions
): T {
  const {
    adapter,
    prefix = DEFAULT_PREFIX,
    ttlMs = DEFAULT_TTL_MS,
    onRestore,
    onPersist,
    onError,
  } = options;

  // Cache for pre-warmed flag values (used for async adapter restore)
  const flagCache = new Map<string, PersistedFlagEntry>();

  return new Proxy(flipFlag, {
    get(target, prop, receiver) {
      if (prop === "init") {
        return async (): Promise<void> => {
          await target.init();

          // Access featuresFlags directly after init and persist all flags
          const featuresFlags = (target as unknown as { featuresFlags?: Record<string, { enabled: boolean }> }).featuresFlags;

          // Validate featuresFlags exists and is an object
          if (!featuresFlags || typeof featuresFlags !== 'object') {
            return;
          }

          const flagNames = Object.keys(featuresFlags);

          // Pre-load existing cache for async restore support
          const loadPromises = flagNames.map(async (flagName) => {
            const storageKey = `${prefix}${flagName}`;
            try {
              const result = adapter.get(storageKey);
              const entry = result instanceof Promise ? await result : result;
              if (entry && (!entry.expiresAt || Date.now() < entry.expiresAt)) {
                flagCache.set(storageKey, entry);
              }
            } catch (e) {
              onError?.(e instanceof Error ? e : new Error(String(e)));
            }
          });
          await Promise.all(loadPromises);

          // Collect all persist promises and await them
          const persistPromises: Promise<void>[] = [];

          for (const [flagName, flag] of Object.entries(featuresFlags)) {
            if (flag && typeof flag.enabled === 'boolean') {
              const storageKey = `${prefix}${flagName}`;
              persistPromises.push(
                persistFlagAsync(adapter, storageKey, flag.enabled, ttlMs, onPersist, flagName, onError, flagCache)
              );
            }
          }

          await Promise.all(persistPromises);
        };
      }

      if (prop === "isEnabled") {
        return (flagName: string): boolean => {
          const storageKey = `${prefix}${flagName}`;

          try {
            // Try to get value from SDK
            const value = target.isEnabled(flagName);

            // Persist on successful read
            persistFlag(adapter, storageKey, value, ttlMs, onPersist, flagName, onError);

            return value;
          } catch {
            // SDK failed, try to restore from cache
            return restoreFlag(adapter, storageKey, onRestore, flagName, onError, flagCache);
          }
        };
      }

      // Proxy all other properties/methods
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  }) as unknown as T;
}

/**
 * Persist a flag value to storage
 */
function persistFlag(
  adapter: StorageAdapter,
  storageKey: string,
  value: boolean,
  ttlMs: number,
  onPersist: PersistenceOptions["onPersist"],
  flagName: string,
  onError: PersistenceOptions["onError"]
): void {
  try {
    const entry: PersistedFlagEntry = {
      value,
      persistedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    const result = adapter.set(storageKey, entry);

    // Handle async adapters
    if (result instanceof Promise) {
      result
        .then(() => onPersist?.(flagName, value))
        .catch((e) => onError?.(e instanceof Error ? e : new Error(String(e))));
    } else {
      onPersist?.(flagName, value);
    }
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Persist a flag value to storage (async version that awaits completion)
 */
async function persistFlagAsync(
  adapter: StorageAdapter,
  storageKey: string,
  value: boolean,
  ttlMs: number,
  onPersist: PersistenceOptions["onPersist"],
  flagName: string,
  onError: PersistenceOptions["onError"],
  flagCache: Map<string, PersistedFlagEntry>
): Promise<void> {
  try {
    const entry: PersistedFlagEntry = {
      value,
      persistedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    const result = adapter.set(storageKey, entry);

    if (result instanceof Promise) {
      await result;
    }

    // Update in-memory cache for async restore support
    flagCache.set(storageKey, entry);

    onPersist?.(flagName, value);
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Restore a flag value from cache
 */
function restoreFlag(
  adapter: StorageAdapter,
  storageKey: string,
  onRestore: PersistenceOptions["onRestore"],
  flagName: string,
  onError: PersistenceOptions["onError"],
  flagCache: Map<string, PersistedFlagEntry>
): boolean {
  // Check pre-warmed in-memory cache first (works for async adapters)
  const cached = flagCache.get(storageKey);
  if (cached && (!cached.expiresAt || Date.now() < cached.expiresAt)) {
    onRestore?.(flagName, cached.value);
    return cached.value;
  }

  // Fall back to sync adapter access (for sync adapters only)
  try {
    const result = adapter.get(storageKey);

    // Handle sync result
    if (!(result instanceof Promise)) {
      if (result && (!result.expiresAt || Date.now() < result.expiresAt)) {
        onRestore?.(flagName, result.value);
        return result.value;
      }
      return false;
    }

    // For async adapters without pre-warmed cache, return false
    return false;
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
    return false;
  }
}

/**
 * Convenience wrapper for localStorage persistence
 */
export function withLocalStorage<T extends FlipFlag>(
  flipFlag: T,
  options?: { prefix?: string; ttlMs?: number }
): T {
  return withPersistence(flipFlag, {
    adapter: localStorageAdapter(),
    prefix: options?.prefix,
    ttlMs: options?.ttlMs,
  });
}

/**
 * Convenience wrapper for sessionStorage persistence
 */
export function withSessionStorage(
  flipFlag: FlipFlag,
  options?: { prefix?: string; ttlMs?: number }
): FlipFlag {
  return withPersistence(flipFlag, {
    adapter: sessionStorageAdapter(),
    prefix: options?.prefix,
    ttlMs: options?.ttlMs,
  });
}

/**
 * Convenience wrapper for cookie persistence
 */
export function withCookies(
  flipFlag: FlipFlag,
  options?: { prefix?: string; ttlMs?: number } & CookieAdapterOptions
): FlipFlag {
  const { prefix, ttlMs, ...cookieOptions } = options ?? {};
  return withPersistence(flipFlag, {
    adapter: cookieAdapter(cookieOptions),
    prefix,
    ttlMs,
  });
}
