import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { CRASHLYTICS, ICrashlytics } from '@platform';

const CHUNK_RELOAD_KEY = '__chunkReloadAt__';
const RELOAD_LOOP_GUARD_MS = 10_000;

/**
 * Detects "stale build" errors — when the running JS bundle references a
 * dynamic chunk that no longer exists on the server (e.g. after a deploy
 * while the user kept the tab open). Each browser surfaces a slightly
 * different message; the regex below covers Chrome, Firefox and Safari.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError|error loading dynamically imported module|Importing a module script failed/i.test(msg);
}

/**
 * Forces a single hard-reload to fetch the freshly deployed index.html and
 * its updated chunk references. Uses sessionStorage to suppress reload
 * loops — if a reload was attempted in the last 10s and we're still hitting
 * the same error, something else is wrong (rare) and we let it through.
 */
export function reloadOnceForStaleBuild(): void {
  if (typeof window === 'undefined') return;
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0;
  if (Date.now() - last < RELOAD_LOOP_GUARD_MS) {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return;
  }
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
}

@Injectable()
export class ChunkLoadErrorHandler implements ErrorHandler {
  /**
   * Resolved lazily on the first non-chunk error rather than injected
   * eagerly: the ErrorHandler can be constructed before the platform
   * providers are ready, and we must never let DI ordering turn the global
   * error handler into a crash itself.
   */
  private readonly injector = inject(Injector);
  private crashlytics: ICrashlytics | null = null;

  handleError(error: unknown): void {
    if (isChunkLoadError(error)) {
      reloadOnceForStaleBuild();
      return;
    }

    // Report to Crashlytics on native (no-op on web). Best-effort and fully
    // guarded so a telemetry failure can never mask the original error.
    try {
      this.crashlytics ??= this.injector.get(CRASHLYTICS, null);
      const message = error instanceof Error ? error.message : String(error);
      void this.crashlytics?.recordException(message, error);
    } catch {
      /* never let crash reporting throw out of the global handler */
    }

    console.error(error);
  }
}
