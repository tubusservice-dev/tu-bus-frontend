import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import {
  Order,
  ORDER_STATUS_LABELS,
  DISPATCH_TYPE_LABELS,
  DispatchType,
  isOilChangeOrder,
} from '../../../models/order.model';
import { CopyableValueComponent } from '../../../shared/components/copyable-value/copyable-value.component';
import { RatingModalComponent } from '../../../shared/components/rating-modal/rating-modal.component';
import { ReviewService } from '../../../core/services/review.service';

@Component({
  selector: 'app-checkout-confirmation',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, CopyableValueComponent, RatingModalComponent],
  templateUrl: './checkout-confirmation.component.html',
  styleUrl: './checkout-confirmation.component.scss',
})
export class CheckoutConfirmationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly reviewService = inject(ReviewService);

  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);

  // Rating modal state — opens once per page load if the user has not rated yet.
  protected readonly showRatingModal = signal(false);
  protected readonly isSubmittingRating = signal(false);
  protected readonly ratingSubmitError = signal<string | null>(null);
  private hasCheckedReview = false;

  /** True when this order is a service (oil change at home or in-store). */
  protected readonly isOilChange = computed(() => {
    const o = this.order();
    return o ? isOilChangeOrder(o) : false;
  });

  /** True when the order carries at least one vehicle (populated or id-only). */
  protected readonly hasVehicles = computed(
    () => (this.order()?.vehicles?.length ?? 0) > 0,
  );

  /**
   * Returns only populated vehicles (objects with `placa/marca/modelo`).
   * Filters out id-only entries so the template can iterate safely without
   * needing `typeof` guards (unsupported in Angular templates).
   */
  protected readonly populatedVehicles = computed(() => {
    const vs = this.order()?.vehicles ?? [];
    return vs.filter(
      (v): v is { id: string; placa: string; marca: string; modelo: string; year: number } =>
        !!v && typeof v === 'object',
    );
  });

  /** True when the payment submission exists and has at least one populated field. */
  protected readonly hasPaymentSubmission = computed(() => {
    const ps = this.order()?.paymentSubmission;
    return !!(ps && (ps.referenceNumber || ps.amount || ps.sourceBank));
  });

  /** True when a non-empty billing address was captured. */
  protected readonly hasBillingAddress = computed(() => {
    const ba = this.order()?.billingAddress;
    return !!(ba && (ba.fullName || ba.address));
  });

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) {
      this.router.navigate(['/catalogo']);
      return;
    }

    this.orderService.getOrderById(orderId).subscribe({
      next: (response) => {
        this.order.set(response.data);
        this.isLoading.set(false);
        this.checkReviewAndMaybeOpenModal(orderId);
      },
      error: () => {
        this.isLoading.set(false);
        this.router.navigate(['/catalogo']);
      },
    });
  }

  private checkReviewAndMaybeOpenModal(orderId: string): void {
    if (this.hasCheckedReview) return;
    this.hasCheckedReview = true;

    this.reviewService.getByOrder(orderId).subscribe({
      next: (res) => {
        if (!res.data) {
          this.showRatingModal.set(true);
        }
      },
      error: () => {
        // Silent: if the check fails (offline, 401), we simply skip opening the modal.
      },
    });
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] || status;
  }

  /** Human label for a dispatch type, e.g. "Cambio de Aceite". */
  getDispatchLabel(type: string): string {
    return DISPATCH_TYPE_LABELS[type as DispatchType] || type;
  }

  /**
   * Human label for a billing address source. Explains to the user where
   * the billing data came from when the address line itself is missing.
   */
  getBillingSourceLabel(source?: string): string {
    switch (source) {
      case 'shipping': return 'Misma dirección de envío';
      case 'profile':  return 'Dirección del perfil';
      case 'custom':   return 'Dirección personalizada';
      default:         return 'Facturación';
    }
  }

  /**
   * Compose a recipient line "Address[, City[, Municipality[, State]]]".
   * Filters out empty/undefined parts to avoid dangling commas.
   */
  buildLocationLine(parts: (string | undefined)[]): string {
    return parts.filter((p) => !!p && String(p).trim() !== '').join(', ');
  }

  /** Track-by helper for items list. */
  trackByIndex = (index: number): number => index;

  goToOrders(): void {
    this.router.navigate(['/perfil'], { fragment: 'orders' });
  }

  goToStore(): void {
    this.router.navigate(['/catalogo']);
  }

  protected onRatingClosed(): void {
    this.showRatingModal.set(false);
    this.ratingSubmitError.set(null);
  }

  protected onRatingSubmitted(payload: { rating: number; comment: string }): void {
    const orderId = this.order()?.id;
    if (!orderId) return;

    this.isSubmittingRating.set(true);
    this.ratingSubmitError.set(null);

    this.reviewService.create({
      orderId,
      rating: payload.rating,
      comment: payload.comment || undefined,
    }).subscribe({
      next: () => {
        this.isSubmittingRating.set(false);
        this.showRatingModal.set(false);
      },
      error: (err) => {
        this.isSubmittingRating.set(false);
        const msg = err?.error?.message ?? 'No pudimos guardar tu valoración. Intenta nuevamente.';
        this.ratingSubmitError.set(msg);
      },
    });
  }
}
