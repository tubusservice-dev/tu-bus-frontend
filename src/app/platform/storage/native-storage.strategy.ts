import { IStorage } from './storage.service';

/**
 * Native storage backed by Capacitor Preferences (Android: SharedPreferences,
 * iOS: UserDefaults — both encrypted at rest by the OS on modern versions).
 *
 * The plugin import is dynamic so the web bundle never includes
 * `@capacitor/preferences` — the strategy is only constructed inside the
 * native APK where the plugin is present at runtime.
 */
export class NativeStorageStrategy implements IStorage {
  async get(key: string): Promise<string | null> {
    const { Preferences } = await import('@capacitor/preferences');
    const result = await Preferences.get({ key });
    return result.value;
  }

  async set(key: string, value: string): Promise<void> {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
  }

  async clear(): Promise<void> {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.clear();
  }
}
