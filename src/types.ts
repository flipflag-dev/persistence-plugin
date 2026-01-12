/**
 * Single flag storage format
 */
export interface PersistedFlagEntry {
  /** The flag value */
  value: boolean;
  /** Unix timestamp when data was persisted */
  persistedAt: number;
  /** Unix timestamp when data expires (optional) */
  expiresAt?: number;
}

/**
 * Storage adapter interface
 * Adapters work with individual flags, each stored under its own key
 */
export interface StorageAdapter {
  /**
   * Retrieve persisted flag data by key
   * @param key The storage key (includes prefix)
   * @returns The persisted entry, or undefined if not found/expired
   */
  get(key: string): PersistedFlagEntry | undefined | Promise<PersistedFlagEntry | undefined>;

  /**
   * Store flag data by key
   * @param key The storage key (includes prefix)
   * @param entry The flag entry to persist
   */
  set(key: string, entry: PersistedFlagEntry): void | Promise<void>;

  /**
   * Remove persisted data by key
   * @param key The storage key (includes prefix)
   */
  remove(key: string): void | Promise<void>;

  /**
   * Check if storage is available in current environment
   */
  isAvailable(): boolean;
}

/**
 * Configuration for persistence behavior
 */
export interface PersistenceOptions {
  /** Storage adapter to use */
  adapter: StorageAdapter;

  /** Key prefix for storage (default: 'flipflag:') */
  prefix?: string;

  /** Time-to-live in milliseconds (default: 24 hours) */
  ttlMs?: number;

  /** Called when a flag is restored from cache */
  onRestore?: (flagName: string, value: boolean) => void;

  /** Called when a flag is persisted */
  onPersist?: (flagName: string, value: boolean) => void;

  /** Called on persistence errors */
  onError?: (error: Error) => void;
}

/**
 * Options for cookie adapter
 */
export interface CookieAdapterOptions {
  /** Cookie path (default: '/') */
  path?: string;
  /** Cookie domain */
  domain?: string;
  /** Secure flag (default: true in production) */
  secure?: boolean;
  /** SameSite attribute (default: 'lax') */
  sameSite?: "strict" | "lax" | "none";
}
