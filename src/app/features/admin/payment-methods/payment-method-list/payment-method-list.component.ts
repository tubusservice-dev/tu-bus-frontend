import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PaymentMethodService } from '../../../../core/services/payment-method.service';
import {
  PaymentMethodConfig,
  PaymentMethodType,
  PAYMENT_METHOD_TYPE_LABELS,
} from '../../../../models/payment-method.model';

@Component({
  selector: 'app-payment-method-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './payment-method-list.component.html',
  styleUrl: './payment-method-list.component.scss',
})
export class PaymentMethodListComponent implements OnInit {
  private readonly service = inject(PaymentMethodService);

  protected readonly isLoading = signal(true);
  protected readonly methods = signal<PaymentMethodConfig[]>([]);
  protected readonly isToggling = signal<string | null>(null);
  protected readonly isDeleting = signal<string | null>(null);
  protected readonly methodToDelete = signal<PaymentMethodConfig | null>(null);

  ngOnInit(): void {
    this.loadMethods();
  }

  loadMethods(): void {
    this.isLoading.set(true);
    this.service.getAll().subscribe({
      next: (response) => {
        this.methods.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  getTypeLabel(type: PaymentMethodType): string {
    return PAYMENT_METHOD_TYPE_LABELS[type] || type;
  }

  getTypeIcon(type: PaymentMethodType): string {
    switch (type) {
      case PaymentMethodType.PAGO_MOVIL:
        return 'M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3';
      case PaymentMethodType.TRANSFERENCIA:
        return 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z';
      case PaymentMethodType.EFECTIVO_DIVISAS:
        return 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z';
      case PaymentMethodType.TARJETA:
        return 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z';
      default:
        return '';
    }
  }

  getMethodDetails(method: PaymentMethodConfig): string {
    switch (method.type) {
      case PaymentMethodType.PAGO_MOVIL:
        return method.pagoMovil ? `${method.pagoMovil.phoneNumber} - ${method.pagoMovil.bankName}` : '-';
      case PaymentMethodType.TRANSFERENCIA:
        return method.transferencia ? `${method.transferencia.accountNumber} - ${method.transferencia.bankName}` : '-';
      case PaymentMethodType.EFECTIVO_DIVISAS:
      case PaymentMethodType.TARJETA:
        return method.customMessage || 'Sin mensaje';
      default:
        return '-';
    }
  }

  toggleStatus(method: PaymentMethodConfig): void {
    this.isToggling.set(method.id);
    this.service.toggleActive(method.id).subscribe({
      next: (response) => {
        this.methods.update((items) =>
          items.map((m) => (m.id === method.id ? response.data : m))
        );
        this.isToggling.set(null);
      },
      error: () => {
        this.isToggling.set(null);
      },
    });
  }

  openDeleteModal(method: PaymentMethodConfig): void {
    this.methodToDelete.set(method);
  }

  closeDeleteModal(): void {
    this.methodToDelete.set(null);
  }

  confirmDelete(): void {
    const method = this.methodToDelete();
    if (!method) return;

    this.isDeleting.set(method.id);
    this.service.delete(method.id).subscribe({
      next: () => {
        this.methods.update((items) => items.filter((m) => m.id !== method.id));
        this.isDeleting.set(null);
        this.methodToDelete.set(null);
      },
      error: () => {
        this.isDeleting.set(null);
      },
    });
  }
}
