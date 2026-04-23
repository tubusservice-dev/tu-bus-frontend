import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../../core/services/payment.service';
import { UploadService } from '../../../../core/services/upload.service';
import {
  Payment,
  PaymentStatus,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
} from '../../../../models/payment.model';
import { DateInputComponent } from '../../../../shared/components/date-input/date-input.component';

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, DateInputComponent],
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.scss',
})
export class PaymentHistoryComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);
  private readonly uploadService = inject(UploadService);

  /** Today as ISO `YYYY-MM-DD` — used to cap editable payment dates in the past. */
  protected readonly todayStr = new Date().toISOString().split('T')[0];

  protected readonly payments = signal<Payment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly editingPaymentId = signal<string | null>(null);
  protected readonly isUploading = signal(false);
  protected readonly isSaving = signal(false);

  // Edit form fields
  protected editReferenceNumber = '';
  protected editTransactionAmount: number | null = null;
  protected editPaymentDate = '';
  protected editCaptureUrl = '';
  protected editCapturePublicId = '';

  // Pagination
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);

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
    this.paymentService.getMyPayments(page, 10).subscribe({
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

  getOrderNumber(payment: Payment): string {
    if (typeof payment.order === 'object' && payment.order) {
      return payment.order.orderNumber;
    }
    return payment.order as string;
  }

  startEdit(payment: Payment): void {
    this.editingPaymentId.set(payment.id);
    this.editReferenceNumber = payment.referenceNumber || '';
    this.editTransactionAmount = payment.transactionAmount || null;
    this.editPaymentDate = payment.paymentDate ? payment.paymentDate.substring(0, 10) : '';
    this.editCaptureUrl = payment.captureUrl || '';
    this.editCapturePublicId = '';
  }

  cancelEdit(): void {
    this.editingPaymentId.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.isUploading.set(true);

    this.uploadService.uploadImage(file, 'payments').subscribe({
      next: (res) => {
        this.editCaptureUrl = res.data.url;
        this.editCapturePublicId = res.data.publicId;
        this.isUploading.set(false);
      },
      error: () => {
        this.isUploading.set(false);
      },
    });
  }

  saveEdit(): void {
    const id = this.editingPaymentId();
    if (!id) return;

    this.isSaving.set(true);

    const data: Record<string, unknown> = {};
    if (this.editReferenceNumber) data['referenceNumber'] = this.editReferenceNumber;
    if (this.editTransactionAmount) data['transactionAmount'] = this.editTransactionAmount;
    if (this.editPaymentDate) data['paymentDate'] = this.editPaymentDate;
    if (this.editCaptureUrl) data['captureUrl'] = this.editCaptureUrl;
    if (this.editCapturePublicId) data['capturePublicId'] = this.editCapturePublicId;

    this.paymentService.updatePayment(id, data).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.editingPaymentId.set(null);
        this.loadPayments(this.currentPage());
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadPayments(page);
  }
}
