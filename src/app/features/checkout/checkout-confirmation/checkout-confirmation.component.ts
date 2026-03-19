import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { Order, ORDER_STATUS_LABELS } from '../../../models/order.model';

@Component({
  selector: 'app-checkout-confirmation',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './checkout-confirmation.component.html',
  styleUrl: './checkout-confirmation.component.scss',
})
export class CheckoutConfirmationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);

  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);

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
      },
      error: () => {
        this.isLoading.set(false);
        this.router.navigate(['/catalogo']);
      },
    });
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] || status;
  }

  goToOrders(): void {
    this.router.navigate(['/perfil'], { fragment: 'orders' });
  }

  goToStore(): void {
    this.router.navigate(['/catalogo']);
  }
}