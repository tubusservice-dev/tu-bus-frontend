import { InjectionToken } from '@angular/core';

/**
 * Cross-platform key-value storage abstraction.
 *
 * Web implementation wraps `localStorage` with Promise-based signatures so
 * the API is identical across platforms. Native implementation (Android)
 * uses `@capacitor/preferences` which writes to SharedPreferences (encrypted
 * on Android M+). Consumers never know which backend they are talking to.
 *
 * Async by design: native storage requires it (Preferences API is async).
 * The web wrapper adds negligible overhead — `Promise.resolve` resolves in
 * the next microtask, sub-millisecond.
 */
export interface IStorage {
  /** Returns the value for `key`, or `null` when absent or read fails. */
  get(key: string): Promise<string | null>;

  /** Persists `value` under `key`. Overwrites any previous value. */
  set(key: string, value: string): Promise<void>;

  /** Removes the entry for `key`. No-op if absent. */
  remove(key: string): Promise<void>;

  /**
   * Clears ALL entries owned by the app's storage scope. Used by logout.
   * Web: clears the entire localStorage of the origin (use carefully).
   * Native: clears only the Capacitor Preferences scope, leaving other apps
   * untouched.
   */
  clear(): Promise<void>;
}

/**
 * DI token consumed by services that need cross-platform storage. The
 * concrete implementation is bound by `provideStorage()` in
 * `platform.providers.ts` based on `PlatformService.isNative()`.
 */
export const STORAGE = new InjectionToken<IStorage>('PLATFORM_STORAGE');
