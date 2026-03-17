import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { Order, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../models/order.model';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
})
export class OrderListComponent implements OnInit {
  protected readonly orderService = inject(OrderService);
  protected readonly selectedOrder = signal<Order | null>(null);
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statusColors = ORDER_STATUS_COLORS;

  ngOnInit(): void {
    this.orderService.getMyOrders().subscribe();
  }

  getStatusLabel(status: OrderStatus): string {
    return this.statusLabels[status] || status;
  }

  getStatusClass(status: OrderStatus): string {
    return this.statusColors[status] || '';
  }

  viewDetail(order: Order): void {
    this.selectedOrder.set(order);
  }

  closeDetail(): void {
    this.selectedOrder.set(null);
  }

  cancelOrder(order: Order): void {
    if (!confirm(`¿Cancelar la orden ${order.orderNumber}?`)) return;

    this.orderService.cancelOrder(order.id).subscribe({
      next: () => this.orderService.getMyOrders().subscribe(),
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}