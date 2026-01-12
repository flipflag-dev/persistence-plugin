// Core types
export type {
  PersistedFlagEntry,
  StorageAdapter,
  PersistenceOptions,
  CookieAdapterOptions,
} from "./types";

// Main wrapper functions
export {
  withPersistence,
  withLocalStorage,
  withSessionStorage,
  withCookies,
} from "./with-persistence";

// Adapters
export {
  localStorageAdapter,
  sessionStorageAdapter,
  cookieAdapter,
  memoryAdapter,
} from "./adapters";
