import { ICrashlytics } from './crashlytics.service';

/**
 * Web crash reporting strategy: a deliberate no-op.
 *
 * Crashlytics does not exist in the Firebase JS SDK — it is exclusive to
 * native platforms. On web, uncaught errors are already surfaced by the
 * global `ChunkLoadErrorHandler` (console + stale-build reload). This class
 * exists only so consumers can inject `CRASHLYTICS` without branching on
 * platform; all methods resolve immediately and do nothing.
 */
export class WebCrashlyticsStrategy implements ICrashlytics {
  async setEnabled(): Promise<void> {
    /* no-op: Crashlytics is native-only */
  }

  async recordException(): Promise<void> {
    /* no-op: Crashlytics is native-only */
  }

  async log(): Promise<void> {
    /* no-op: Crashlytics is native-only */
  }

  async setUserId(): Promise<void> {
    /* no-op: Crashlytics is native-only */
  }
}
