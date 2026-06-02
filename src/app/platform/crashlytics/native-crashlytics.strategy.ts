import { ICrashlytics } from './crashlytics.service';

/**
 * Native crash reporting strategy backed by `@capacitor-firebase/crashlytics`.
 *
 * The plugin module is imported lazily inside each method (rather than at
 * file top) so the native dependency is split into its own chunk and never
 * weighs on the web bundle — the factory in `platform.providers.ts` only
 * instantiates this class on a native platform.
 *
 * Robustness contract: every method is wrapped so a plugin failure resolves
 * silently. Crash telemetry is best-effort; it must not throw back into the
 * caller (especially the global ErrorHandler, which would otherwise loop).
 */
export class NativeCrashlyticsStrategy implements ICrashlytics {
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      const { FirebaseCrashlytics } = await import('@capacitor-firebase/crashlytics');
      await FirebaseCrashlytics.setEnabled({ enabled });
    } catch (err) {
      console.warn('[Crashlytics] setEnabled failed:', err);
    }
  }

  async recordException(message: string, error?: unknown): Promise<void> {
    try {
      const { FirebaseCrashlytics } = await import('@capacitor-firebase/crashlytics');
      await FirebaseCrashlytics.recordException({ message: this.buildMessage(message, error) });
    } catch (err) {
      console.warn('[Crashlytics] recordException failed:', err);
    }
  }

  async log(message: string): Promise<void> {
    try {
      const { FirebaseCrashlytics } = await import('@capacitor-firebase/crashlytics');
      await FirebaseCrashlytics.log({ message });
    } catch (err) {
      console.warn('[Crashlytics] log failed:', err);
    }
  }

  async setUserId(userId: string | null): Promise<void> {
    try {
      const { FirebaseCrashlytics } = await import('@capacitor-firebase/crashlytics');
      // The plugin requires a string; an empty string clears the association.
      await FirebaseCrashlytics.setUserId({ userId: userId ?? '' });
    } catch (err) {
      console.warn('[Crashlytics] setUserId failed:', err);
    }
  }

  /**
   * Folds an optional `Error` into the recorded message. Without
   * stacktrace.js we cannot pass a structured `stacktrace[]`, so the stack
   * is appended verbatim — Crashlytics still groups and displays it,
   * preserving the context that led to the non-fatal report.
   */
  private buildMessage(message: string, error?: unknown): string {
    if (error instanceof Error) {
      const stack = error.stack ? `\n${error.stack}` : '';
      return `${message} | ${error.name}: ${error.message}${stack}`;
    }
    if (error !== undefined) {
      return `${message} | ${String(error)}`;
    }
    return message;
  }
}
