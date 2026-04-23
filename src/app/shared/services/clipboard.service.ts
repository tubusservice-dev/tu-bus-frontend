import { Injectable } from '@angular/core';

/**
 * Cross-cutting clipboard utility. Single source of truth for copy-to-clipboard
 * with a graceful fallback chain:
 *   1. Async Clipboard API (HTTPS + secure contexts) — preferred.
 *   2. Legacy `document.execCommand('copy')` via hidden textarea — for older
 *      browsers or non-secure contexts (HTTP, file://).
 */
@Injectable({ providedIn: 'root' })
export class ClipboardService {
  async write(text: string): Promise<boolean> {
    if (!text) return false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fall through to legacy fallback
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}
