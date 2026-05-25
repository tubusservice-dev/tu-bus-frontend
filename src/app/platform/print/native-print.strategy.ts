import { IPrint, PrintOptions } from './print.service';

/**
 * Native implementation: routes the document through Android's `PrintManager`
 * via the `@bcyesil/capacitor-plugin-printer` plugin. The OS surface lets
 * the user pick a physical printer, "Save as PDF" to internal storage, or
 * share the rendered document to another app.
 *
 * Why not `window.print()`: Chromium's Android WebView ships `window.print`
 * as a no-op. Calling it does nothing and produces no error — leaving the
 * user staring at an unresponsive button. The plugin bridges to the native
 * print framework which is the only reliable path on Android.
 *
 * The plugin import is dynamic so the web bundle never pulls the native
 * plugin code. Matches the pattern used by every other native-only
 * strategy in this layer (camera, geolocation, messaging).
 */
export class NativePrintStrategy implements IPrint {
  async print(options: PrintOptions = {}): Promise<void> {
    const { Printer } = await import('@bcyesil/capacitor-plugin-printer');

    // Default to a live snapshot of the current document so callers don't
    // have to pre-render anything — matches the implicit contract of
    // `window.print()` (print what is on screen).
    const html = options.html ?? document.documentElement.outerHTML;
    const name = options.title ?? 'documento';

    await Printer.print({
      name,
      content: html,
      orientation: 'portrait',
    });
  }
}
