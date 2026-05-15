import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EXTERNAL_LINK, IExternalLink } from '@platform';
import { toVenezuelanE164, toWhatsAppDigits } from '@shared/utils/phone.util';

/**
 * Square icon-only button that opens a 3-option popover for reaching out to
 * the support agent linked to a given order. Mirrors the visual language of
 * the header cart button (square tile, themed via the same CSS variables) and
 * the user-menu dropdown (rounded card, slide-down animation, theme-aware).
 *
 * Reused across the order confirmation screen, the customer order-detail and
 * the admin order-detail. The phone supplied via the `phone` input is the
 * dispatching branch contact persisted on the order — same value is used for
 * both Call and WhatsApp.
 */
@Component({
  selector: 'app-customer-support-action',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-support-action.component.html',
  styleUrl: './customer-support-action.component.scss',
})
export class CustomerSupportActionComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly externalLink = inject<IExternalLink>(EXTERNAL_LINK);

  /** Raw phone string. Accepts any VE format; invalid input keeps the popover
   *  open but disables both Call and WhatsApp. */
  readonly phone = input<string | null | undefined>(undefined);

  /** True when the order has unread messages from the opposite party.
   *  Paints a red dot on the trigger button (top-right). */
  readonly hasUnreadMessages = input<boolean>(false);

  /** Emitted when the user clicks the "Mensajería" option. The parent owns
   *  the modal that actually renders the thread. */
  readonly messagingClick = output<void>();

  protected readonly isOpen = signal(false);

  /** Normalized E.164 (`+58XXXXXXXXXX`) — empty when input is missing/invalid. */
  protected readonly e164 = computed(() => toVenezuelanE164(this.phone()));
  /** Digits for `wa.me/<digits>` — empty when input is missing/invalid. */
  protected readonly waDigits = computed(() => toWhatsAppDigits(this.phone()));
  /** True when the supplied phone is a valid VE mobile. Gates Call/WhatsApp. */
  protected readonly canContact = computed(() => this.e164() !== '');

  toggle(event: MouseEvent): void {
    // Prevent the outside-click HostListener from immediately closing the
    // popover we are about to open.
    event.stopPropagation();
    this.isOpen.update((v) => !v);
  }

  protected callPhone(): void {
    if (!this.canContact()) return;
    void this.externalLink.open(`tel:${this.e164()}`, '_self');
    this.isOpen.set(false);
  }

  protected openWhatsApp(): void {
    if (!this.canContact()) return;
    void this.externalLink.open(`https://wa.me/${this.waDigits()}`, '_blank');
    this.isOpen.set(false);
  }

  protected onMessagingClick(): void {
    this.messagingClick.emit();
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
