# @flipflag/persist

Persistence plugin for FlipFlag SDK - offline resilience with pluggable storage adapters.

## Features

- **Offline resilience** - Flag values persist and restore when SDK is unavailable
- **Multiple storage backends** - localStorage, sessionStorage, cookies, or in-memory
- **TTL support** - Automatic expiration of cached values
- **Zero config** - Sensible defaults, just wrap your FlipFlag instance
- **TypeScript** - Full type definitions included
- **Tree-shakeable** - Import only what you need

## Installation

```bash
npm install @flipflag/persist
```

**Peer dependency:** Requires `@flipflag/sdk` >= 1.2.0

## Quick Start

```typescript
import { FlipFlag } from "@flipflag/sdk";
import { withLocalStorage } from "@flipflag/persist";

const flipFlag = new FlipFlag({ apiKey: "your-api-key" });
const persistedFlipFlag = withLocalStorage(flipFlag);

// Flag values are now automatically persisted
const isEnabled = persistedFlipFlag.isEnabled("my-feature");
```

## Storage Adapters

### localStorage (recommended for web)

```typescript
import { withLocalStorage } from "@flipflag/persist";

const persistedFlipFlag = withLocalStorage(flipFlag, {
  prefix: "ff:", // Storage key prefix (default: "flipflag:")
  ttlMs: 3600000, // TTL in ms (default: 24 hours)
});
```

### sessionStorage

```typescript
import { withSessionStorage } from "@flipflag/persist";

const persistedFlipFlag = withSessionStorage(flipFlag, {
  prefix: "ff:",
  ttlMs: 3600000,
});
```

### Cookies

```typescript
import { withCookies } from "@flipflag/persist";

const persistedFlipFlag = withCookies(flipFlag, {
  prefix: "ff:",
  ttlMs: 3600000,
  // Cookie-specific options:
  path: "/",
  domain: "example.com",
  secure: true,
  sameSite: "lax", // "strict" | "lax" | "none"
});
```

### Custom Adapter

```typescript
import { withPersistence, StorageAdapter } from "@flipflag/persist";

const customAdapter: StorageAdapter = {
  get(key) {
    // Return PersistedFlagEntry or undefined
  },
  set(key, entry) {
    // Store the entry
  },
  remove(key) {
    // Remove the entry
  },
  isAvailable() {
    return true;
  },
};

const persistedFlipFlag = withPersistence(flipFlag, {
  adapter: customAdapter,
  prefix: "ff:",
  ttlMs: 3600000,
});
```

## API Reference

### `withPersistence(flipFlag, options)`

Wrap a FlipFlag instance with persistence capabilities.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `adapter` | `StorageAdapter` | required | Storage adapter to use |
| `prefix` | `string` | `"flipflag:"` | Key prefix for storage |
| `ttlMs` | `number` | `86400000` | Time-to-live in milliseconds (24h) |
| `onRestore` | `(flagName, value) => void` | - | Called when a flag is restored from cache |
| `onPersist` | `(flagName, value) => void` | - | Called when a flag is persisted |
| `onError` | `(error) => void` | - | Called on persistence errors |

### `withLocalStorage(flipFlag, options?)`

Convenience wrapper using localStorage.

### `withSessionStorage(flipFlag, options?)`

Convenience wrapper using sessionStorage.

### `withCookies(flipFlag, options?)`

Convenience wrapper using cookies.

**Additional cookie options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | `"/"` | Cookie path |
| `domain` | `string` | - | Cookie domain |
| `secure` | `boolean` | `true` in production | Secure flag |
| `sameSite` | `"strict" \| "lax" \| "none"` | `"lax"` | SameSite attribute |

### Built-in Adapters

```typescript
import {
  localStorageAdapter,
  sessionStorageAdapter,
  cookieAdapter,
  memoryAdapter,
} from "@flipflag/persist";
```

- `localStorageAdapter()` - Browser localStorage
- `sessionStorageAdapter()` - Browser sessionStorage
- `cookieAdapter(options?)` - Browser cookies
- `memoryAdapter()` - In-memory storage (useful for SSR/testing)

## Types

```typescript
interface PersistedFlagEntry {
  value: boolean;
  persistedAt: number;
  expiresAt?: number;
}

interface StorageAdapter {
  get(key: string): PersistedFlagEntry | undefined | Promise<PersistedFlagEntry | undefined>;
  set(key: string, entry: PersistedFlagEntry): void | Promise<void>;
  remove(key: string): void | Promise<void>;
  isAvailable(): boolean;
}

interface PersistenceOptions {
  adapter: StorageAdapter;
  prefix?: string;
  ttlMs?: number;
  onRestore?: (flagName: string, value: boolean) => void;
  onPersist?: (flagName: string, value: boolean) => void;
  onError?: (error: Error) => void;
}

interface CookieAdapterOptions {
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
}
```

## How It Works

The plugin wraps your FlipFlag instance with a Proxy that intercepts `isEnabled()` calls:

1. When you call `isEnabled(flagName)`:
   - If SDK succeeds: Value is returned and persisted to storage
   - If SDK fails: Value is restored from cache (if not expired)

2. Each flag is stored individually with its own TTL

3. Storage keys follow the pattern: `{prefix}{flagName}`

## License

MIT
