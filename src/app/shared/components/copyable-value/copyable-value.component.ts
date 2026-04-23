import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClipboardService } from '../../services/clipboard.service';

/**
 * Displays a label + value pair with a copy-to-clipboard button. Shows a
 * transient "Copiado" confirmation for 1.5s after a successful copy.
 *
 * Delegates clipboard I/O to `ClipboardService` — keeps this component focused
 * on presentation.
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
  /**
   * Alternate text placed on the clipboard when the user copies. Use when the
   * displayed value is formatted for humans (e.g. "Bs 1.234,56") but the
   * pasteable form must be raw ("1234.56"). Falls back to `value` when unset.
   */
  @Input() copyValue: string | number | null | undefined = undefined;
  /** Render value in monospace font — useful for numeric IDs, accounts, plates */
  @Input() monospace = true;
  /** Row layout (label left, value+button right). Set false for stacked layout. */
  @Input() compactRow = true;

  private readonly clipboard = inject(ClipboardService);
  protected readonly copied = signal(false);
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  protected get displayValue(): string {
    return this.value === null || this.value === undefined ? '' : String(this.value);
  }

  private get textToCopy(): string {
    const raw = this.copyValue !== undefined && this.copyValue !== null
      ? this.copyValue
      : this.value;
    return raw === null || raw === undefined ? '' : String(raw);
  }

  async onCopy(): Promise<void> {
    const text = this.textToCopy;
    if (!text) return;

    const ok = await this.clipboard.write(text);
    if (ok) this.showCopiedFeedback();
  }

  private showCopiedFeedback(): void {
    this.copied.set(true);
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    this.copyTimeout = setTimeout(() => this.copied.set(false), 1500);
  }
}
