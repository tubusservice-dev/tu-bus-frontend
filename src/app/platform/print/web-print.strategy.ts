import { IPrint, PrintOptions } from './print.service';

/**
 * Web implementation: thin wrapper over `window.print()`. The browser
 * handles `@media print` CSS, `.no-print` / `.print-only` toggling, and
 * the dialog UX — nothing to reimplement here.
 *
 * The `title` and `html` options are intentionally ignored on web: the
 * browser uses the document's own `<title>` and DOM, and overriding either
 * would mean opening a new window/iframe which is more invasive than the
 * benefit on desktop where the user already sees the page they want to
 * print.
 */
export class WebPrintStrategy implements IPrint {
  async print(_options: PrintOptions = {}): Promise<void> {
    window.print();
  }
}
