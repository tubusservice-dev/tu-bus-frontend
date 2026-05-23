import { InjectionToken } from '@angular/core';

/**
 * Cross-platform abstraction for sending the current document to the user's
 * print pipeline.
 *
 * Web: invokes the browser's native print dialog (`window.print()`) — works
 * out of the box on every desktop and mobile browser. The user picks
 * "Save as PDF" or a physical printer.
 *
 * Native (Android): delegates to the Android `PrintManager` via the
 * Capacitor printer plugin. The OS shows its native sheet with options to
 * pick installed printers, "Save as PDF" to device storage, or share to
 * other apps. `window.print()` is a no-op inside the Android WebView, which
 * is why the abstraction exists.
 *
 * The caller passes the document title (used as the spool job name and the
 * suggested PDF filename) plus an optional HTML override. When `html` is
 * omitted, the native strategy snapshots `document.documentElement.outerHTML`
 * so the print job mirrors whatever the user is looking at — same flow as
 * `window.print()`.
 */
export interface PrintOptions {
  /** Human-readable name for the print job / suggested PDF filename. */
  title?: string;
  /**
   * HTML string to print instead of the current document. Optional — the
   * native strategy defaults to a snapshot of the current DOM so callers
   * don't have to assemble content manually.
   */
  html?: string;
}

export interface IPrint {
  /**
   * Sends the current document (or the supplied HTML) to the platform's
   * print pipeline. Resolves once the OS dialog has been dispatched —
   * does NOT wait for the user to confirm/cancel.
   */
  print(options?: PrintOptions): Promise<void>;
}

export const PRINT = new InjectionToken<IPrint>('PLATFORM_PRINT');
