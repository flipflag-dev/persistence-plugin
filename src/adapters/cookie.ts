import type {
  StorageAdapter,
  PersistedFlagEntry,
  CookieAdapterOptions,
} from "../types";

/**
 * Create a cookie adapter
 * Each flag is stored as a separate cookie
 */
export function cookieAdapter(options?: CookieAdapterOptions): StorageAdapter {
  const path = options?.path ?? "/";
  const domain = options?.domain;
  const secure =
    options?.secure ??
    (typeof window !== "undefined" &&
      window.location.protocol === "https:");
  const sameSite = options?.sameSite ?? "lax";

  const getCookie = (name: string): string | undefined => {
    if (typeof document === "undefined") return undefined;
    const match = document.cookie.match(
      new RegExp(`(^| )${encodeURIComponent(name)}=([^;]+)`)
    );
    return match ? decodeURIComponent(match[2]) : undefined;
  };

  const setCookie = (name: string, value: string, expiresAt?: number): void => {
    if (typeof document === "undefined") return;

    let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${path}`;

    if (domain) cookieStr += `; domain=${domain}`;
    if (secure) cookieStr += "; secure";
    cookieStr += `; samesite=${sameSite}`;

    if (expiresAt) {
      cookieStr += `; expires=${new Date(expiresAt).toUTCString()}`;
    }

    document.cookie = cookieStr;
  };

  const deleteCookie = (name: string): void => {
    if (typeof document === "undefined") return;
    document.cookie = `${encodeURIComponent(name)}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  };

  return {
    isAvailable(): boolean {
      if (typeof document === "undefined") return false;
      try {
        document.cookie = "__flipflag_test__=1";
        const result = document.cookie.includes("__flipflag_test__");
        document.cookie =
          "__flipflag_test__=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        return result;
      } catch {
        return false;
      }
    },

    get(key: string): PersistedFlagEntry | undefined {
      if (!this.isAvailable()) return undefined;

      try {
        const raw = getCookie(key);
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

        // Check size limit (cookies have ~4KB limit per cookie)
        if (serialized.length > 4000) {
          console.warn(
            `[FlipFlag Persist] Cookie data for "${key}" exceeds 4000 bytes. ` +
              "Consider using localStorage instead."
          );
          return;
        }

        setCookie(key, serialized, entry.expiresAt);
      } catch (e) {
        console.warn("[FlipFlag Persist] Failed to save to cookie:", e);
      }
    },

    remove(key: string): void {
      if (!this.isAvailable()) return;
      deleteCookie(key);
    },
  };
}
