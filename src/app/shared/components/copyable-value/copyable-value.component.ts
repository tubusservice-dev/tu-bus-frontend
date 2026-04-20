import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Displays a label + value pair with a copy-to-clipboard button. Shows a
 * transient "Copiado" confirmation for 1.5s after a successful copy.
 *
 * Uses the modern async Clipboard API with a legacy fallback via
 * document.execCommand('copy') for browsers that don't support it or run in
 * non-secure contexts.
 *
 * Reused across: checkout payment modal (account data), checkout confirmation
 * (order number), profile (fiscal data).
 */
@Component({
  selector: 'app-copyable-value',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './copyable-value.component.html',
  styleUrl: './copyable-value.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyableValueComponent {
  @Input() label = '';
  @Input() value: string | number | null | undefined = '';
  /** Render value in monospace font — useful for numeric IDs, accounts, plates */
  @Input() monospace = true;
  /** Row layout (label left, value+button right). Set false for stacked layout. */
  @Input() compactRow = true;

  protected readonly copied = signal(false);
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  protected get displayValue(): string {
    return this.value === null || this.value === undefined ? '' : String(this.value);
  }

  async onCopy(): Promise<void> {
    const text = this.displayValue;
    if (!text) return;

    const ok = await this.writeToClipboard(text);
    if (ok) this.showCopiedFeedback();
  }

  private async writeToClipboard(text: string): Promise<boolean> {
    // Modern Clipboard API (HTTPS + localhost). Preferred path.
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fall through to legacy fallback
      }
    }

    // Legacy fallback — works on older browsers + non-secure contexts.
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

  private showCopiedFeedback(): void {
    this.copied.set(true);
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    this.copyTimeout = setTimeout(() => this.copied.set(false), 1500);
  }
}
