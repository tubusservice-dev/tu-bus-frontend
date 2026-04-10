import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderService } from '../../../../core/services/order.service';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from '../../../../models/order.model';

@Component({
  selector: 'app-admin-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-order-list.component.html',
  styleUrl: './admin-order-list.component.scss',
})
export class AdminOrderListComponent implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchSubject$ = new Subject<string>();

  protected readonly isLoading = signal(true);
  protected readonly orders = signal<Order[]>([]);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalItems = signal(0);
  protected readonly statusFilter = signal<string>('');
  protected readonly searchQuery = signal('');

  protected readonly ORDER_STATUS_LABELS = ORDER_STATUS_LABELS;

  /** Statuses relevant for admin filtering (excludes mechanic intermediate steps) */
  protected readonly adminFilterStatuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.APPROVED,
    OrderStatus.DISPATCHED,
    OrderStatus.MECHANIC_ASSIGNED,
    OrderStatus.IN_SERVICE,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLATION_REQUESTED,
    OrderStatus.CANCELLED,
  ];

  ngOnInit(): void {
    this.searchSubject$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadOrders(1));

    this.loadOrders();
  }

  loadOrders(page = 1): void {
    this.isLoading.set(true);
    const status = (this.statusFilter() as OrderStatus) || undefined;
    const search = this.searchQuery().trim() || undefined;
    this.orderService.getAdminOrders(page, 10, status, search).subscribe({
      next: (response) => {
        this.orders.set(response.data);
        this.currentPage.set(response.pagination.page);
        this.totalPages.set(response.pagination.pages);
        this.totalItems.set(response.pagination.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  onStatusFilterChange(): void {
    this.loadOrders(1);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchSubject$.next(value);
  }

  get filterableStatuses(): OrderStatus[] {
    return this.adminFilterStatuses;
  }

  getClientName(order: Order): string {
    if (typeof order.user === 'object' && order.user) {
      const name = `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim();
      return name || order.user.email || '-';
    }
    return String(order.user || '-');
  }

  getStatusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  getStatusColor(status: OrderStatus): string {
    return ORDER_STATUS_COLORS[status] || '';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  viewOrderDetail(order: Order): void {
    this.router.navigate(['/admin/orders', order.id]);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadOrders(page);
  }

  get pages(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
