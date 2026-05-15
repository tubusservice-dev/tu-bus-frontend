import { InjectionToken } from '@angular/core';

/**
 * Cross-platform abstraction for opening URLs outside the app.
 *
 * Web: `window.open(url, target)` — `_blank` opens new tab, `_self`
 * navigates current tab.
 * Native: routes by URL scheme:
 *   - `tel:` / `mailto:` / `sms:` / `wa.me/` → `App.openUrl({ url })`
 *     which delegates to the OS, opening the matching native app
 *     (dialer, mail client, WhatsApp).
 *   - `http(s)://` → `Browser.open({ url })` which opens an in-app
 *     Custom Tab (Android) — the user stays inside the app shell while
 *     viewing the external page.
 *
 * The `target` parameter is honoured on web and ignored on native (the
 * OS decides how to surface the URL).
 */
export type ExternalLinkTarget = '_blank' | '_self';

export interface IExternalLink {
  /**
   * Opens a URL externally. Returns when the action completes (web returns
   * after `window.open`; native returns after the OS hands off to the
   * receiving app).
   */
  open(url: string, target?: ExternalLinkTarget): Promise<void>;
}

export const EXTERNAL_LINK = new InjectionToken<IExternalLink>('PLATFORM_EXTERNAL_LINK');
