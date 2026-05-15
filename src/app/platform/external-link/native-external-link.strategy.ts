import { ExternalLinkTarget, IExternalLink } from './external-link.service';

/**
 * Native implementation: routes by URL scheme.
 *
 * - `tel:`, `mailto:`, `sms:`, and `wa.me/` URLs are delegated to the OS
 *   via `window.open(url, '_system')`. The Capacitor WebView intercepts
 *   the `_system` target and dispatches the matching Android Intent so the
 *   dialer / mail client / WhatsApp opens. (Capacitor 8 removed the
 *   `App.openUrl` API used in earlier versions; `_system` is the
 *   documented replacement that works for any URL scheme the OS knows.)
 *
 * - All other URLs (typically https://) open in `Browser` (Capacitor's
 *   wrapper over Chrome Custom Tabs on Android / SafariViewController on
 *   iOS). The user stays inside the app shell; closing the in-app browser
 *   returns them to where they were.
 */
export class NativeExternalLinkStrategy implements IExternalLink {
  async open(url: string, _target: ExternalLinkTarget = '_blank'): Promise<void> {
    if (this.shouldDelegateToOs(url)) {
      window.open(url, '_system');
      return;
    }
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  }

  /**
   * Schemes the OS handles natively (tel/mail/sms) and the WhatsApp deep
   * link `wa.me/*` (which Android/iOS routes to the WhatsApp app when
   * installed).
   */
  private shouldDelegateToOs(url: string): boolean {
    return (
      url.startsWith('tel:') ||
      url.startsWith('mailto:') ||
      url.startsWith('sms:') ||
      url.startsWith('https://wa.me/') ||
      url.startsWith('http://wa.me/')
    );
  }
}
