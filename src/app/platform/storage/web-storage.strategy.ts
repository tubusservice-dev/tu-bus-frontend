import { IStorage } from './storage.service';

/**
 * Web storage backed by `localStorage`. Wraps the synchronous browser API
 * with Promise-based signatures so the consumer code is identical to the
 * native implementation.
 *
 * Failure modes:
 *   - Quota exceeded → set/clear may throw. Wrap with try/catch and resolve
 *     to a rejected promise so the consumer can handle it.
 *   - localStorage disabled (private browsing strict mode in some browsers)
 *     → access throws SecurityError. Same handling.
 */
export class WebStorageStrategy implements IStorage {
  async get(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }
}
