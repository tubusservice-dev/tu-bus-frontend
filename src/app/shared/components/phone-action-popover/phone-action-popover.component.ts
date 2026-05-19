import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EXTERNAL_LINK, IExternalLink } from '@platform';
import { toVenezuelanE164, toWhatsAppDigits } from '@shared/utils/phone.util';

/**
 * Inline button that renders a Venezuelan phone number and, on click, opens
 * a small popover with the two canonical actions: "Llamar" (tel: link) and
 * "WhatsApp" (wa.me link).
 *
 * Single source of truth for the phone-action UI across the app. Replaces
 * the previously duplicated inline pattern (`activePhonePopover` signal +
 * `togglePhonePopover/closePopovers/openWhatsApp/callPhone` helpers) that
 * lived in every order-detail view.
 *
 * Behavior:
 *   - Closes on outside click (via document:click HostListener).
 *   - Closes on Escape (document:keydown.escape HostListener).
 *   - When the supplied phone cannot be parsed by `phone.util`, the
 *     component falls back to a non-interactive plain text so the layout
 *     keeps integrity without exposing broken `tel:` / `wa.me` links.
 */
@Component({
  selector: 'app-phone-action-popover',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phone-action-popover.component.html',
  styleUrl: './phone-action-popover.component.scss',
})
export class PhoneActionPopoverComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly externalLink = inject<IExternalLink>(EXTERNAL_LINK);

  /** Raw phone string. Accepts local (`04XXXXXXXXX`), international
   *  (`+58XXXXXXXXXX`) or anything in between with dashes/spaces — the
   *  component normalizes it internally. */
  readonly phone = input.required<string | null | undefined>();
  /** Optional override for the visible button label. Defaults to the raw
   *  phone string (kept as the user typed it). */
  readonly label = input<string | undefined>(undefined);

  protected readonly isOpen = signal(false);

  /** Normalized E.164 form (`+58XXXXXXXXXX`) or empty when invalid. */
  protected readonly e164 = computed(() => toVenezuelanE164(this.phone()));
  /** Digits used by `wa.me/<digits>`. Empty when invalid. */
  protected readonly waDigits = computed(() => toWhatsAppDigits(this.phone()));
  /** True when the input parses as a valid VE mobile — gates the popover. */
  protected readonly isValid = computed(() => this.e164() !== '');

  protected readonly displayLabel = computed(() => this.label() ?? this.phone() ?? '');

  toggle(event: MouseEvent): void {
    // Stop propagation so the host's outside-click listener doesn't fire
    // immediately after opening.
    event.stopPropagation();
    if (!this.isValid()) return;
    this.isOpen.update((v) => !v);
  }

  protected callPhone(): void {
    const e164 = this.e164();
    if (!e164) return;
    void this.externalLink.open(`tel:${e164}`, '_self');
    this.isOpen.set(false);
  }

  protected openWhatsApp(): void {
    const digits = this.waDigits();
    if (!digits) return;
    void this.externalLink.open(`https://wa.me/${digits}`, '_blank');
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    if (!this.isOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.isOpen()) this.isOpen.set(false);
  }
}
