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

  return new Proxy(flipFlag, {
    get(target, prop, receiver) {
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
            return restoreFlag(adapter, storageKey, onRestore, flagName, onError);
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
 * Restore a flag value from cache
 */
function restoreFlag(
  adapter: StorageAdapter,
  storageKey: string,
  onRestore: PersistenceOptions["onRestore"],
  flagName: string,
  onError: PersistenceOptions["onError"]
): boolean {
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

    // For async adapters, we can't await in a sync function
    // Return false immediately, async restore not supported in isEnabled
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
