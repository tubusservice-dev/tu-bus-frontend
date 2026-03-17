import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../../core/services/payment.service';
import {
  Payment,
  PaymentStatus,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from '../../../../models/payment.model';

@Component({
  selector: 'app-admin-payment-list',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './payment-list.component.html',
  styleUrl: './payment-list.component.scss',
})
export class AdminPaymentListComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);

  // State
  protected readonly payments = signal<Payment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly showAll = signal(false);

  // Pagination
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);

  // Detail modal
  protected readonly selectedPayment = signal<Payment | null>(null);
  protected readonly showDetailModal = signal(false);

  // Approve dialog
  protected readonly showApproveDialog = signal(false);
  protected readonly approvePaymentId = signal<string | null>(null);
  protected readonly isApproving = signal(false);

  // Reject dialog
  protected readonly showRejectDialog = signal(false);
  protected readonly rejectPaymentId = signal<string | null>(null);
  protected readonly isRejecting = signal(false);
  protected rejectionReason = '';

  // Expose to template
  protected readonly statusLabels = PAYMENT_STATUS_LABELS;
  protected readonly statusColors = PAYMENT_STATUS_COLORS;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly PaymentStatus = PaymentStatus;

  ngOnInit(): void {
    this.loadPayments();
  }

  loadPayments(page = 1): void {
    this.isLoading.set(true);

    const request$ = this.showAll()
      ? this.paymentService.getAllPayments(page, 10)
      : this.paymentService.getPendingPayments(page, 10);

    request$.subscribe({
      next: (res) => {
        this.payments.set(res.data);
        this.currentPage.set(res.pagination.page);
        this.totalPages.set(res.pagination.pages);
        this.total.set(res.pagination.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  toggleShowAll(): void {
    this.showAll.update((v) => !v);
    this.loadPayments(1);
  }

  getOrderNumber(payment: Payment): string {
    if (typeof payment.order === 'object' && payment.order) {
      return payment.order.orderNumber;
    }
    return payment.order as string;
  }

  getClientName(payment: Payment): string {
    if (typeof payment.user === 'object' && payment.user) {
      return `${payment.user.firstName} ${payment.user.lastName}`;
    }
    return payment.user as string;
  }

  getClientEmail(payment: Payment): string {
    if (typeof payment.user === 'object' && payment.user) {
      return payment.user.email;
    }
    return '';
  }

  // Detail modal
  openDetail(payment: Payment): void {
    this.selectedPayment.set(payment);
    this.showDetailModal.set(true);
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedPayment.set(null);
  }

  // Approve
  openApproveDialog(paymentId: string): void {
    this.approvePaymentId.set(paymentId);
    this.showApproveDialog.set(true);
  }

  closeApproveDialog(): void {
    this.showApproveDialog.set(false);
    this.approvePaymentId.set(null);
  }

  confirmApprove(): void {
    const id = this.approvePaymentId();
    if (!id) return;

    this.isApproving.set(true);
    this.paymentService.reviewPayment(id, { action: 'approve' }).subscribe({
      next: () => {
        this.isApproving.set(false);
        this.closeApproveDialog();
        this.loadPayments(this.currentPage());
      },
      error: () => {
        this.isApproving.set(false);
      },
    });
  }

  // Reject
  openRejectDialog(paymentId: string): void {
    this.rejectPaymentId.set(paymentId);
    this.rejectionReason = '';
    this.showRejectDialog.set(true);
  }

  closeRejectDialog(): void {
    this.showRejectDialog.set(false);
    this.rejectPaymentId.set(null);
    this.rejectionReason = '';
  }

  confirmReject(): void {
    const id = this.rejectPaymentId();
    if (!id) return;

    this.isRejecting.set(true);
    this.paymentService
      .reviewPayment(id, {
        action: 'reject',
        rejectionReason: this.rejectionReason || undefined,
      })
      .subscribe({
        next: () => {
          this.isRejecting.set(false);
          this.closeRejectDialog();
          this.loadPayments(this.currentPage());
        },
        error: () => {
          this.isRejecting.set(false);
        },
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadPayments(page);
  }
}
