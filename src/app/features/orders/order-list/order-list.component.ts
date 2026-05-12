import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { UserNotificationService } from '../../../core/services/user-notification.service';
import {
  Order, OrderStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
} from '../../../models/order.model';
import { SearchInputComponent } from '../../../shared/components/search-input/search-input.component';

/**
 * Push event `type` prefixes that imply something in this user's order list
 * has changed and the screen should refresh itself silently. Built as a
 * whitelist so unrelated pushes (announcements, future feature events)
 * don't trigger unnecessary HTTP calls.
 */
const ORDER_AFFECTING_PUSH_PREFIXES = [
  'order_',
  'dispatch_',
  'mechanic_',
  'service_',
  'cancellation_',
];

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, SearchInputComponent],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
})
export class OrderListComponent implements OnInit {
  protected readonly orderService = inject(OrderService);
  protected readonly exchangeRateService = inject(ExchangeRateService);
  private readonly userNotifications = inject(UserNotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly isSearching = signal(false);
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statusColors = ORDER_STATUS_COLORS;

  // Pagination
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalItems = signal(0);

  // Filters
  protected readonly statusFilter = signal<OrderStatus | ''>('');
  protected readonly searchQuery = signal('');

  protected readonly filterStatuses = [
    { value: '', label: 'Todas' },
    { value: OrderStatus.PENDING, label: 'Pendientes' },
    { value: OrderStatus.APPROVED, label: 'Aprobadas' },
    { value: OrderStatus.COMPLETED, label: 'Completadas' },
    { value: OrderStatus.CANCELLED, label: 'Canceladas' },
  ];

  ngOnInit(): void {
    this.loadOrders();
    this.subscribeToPushEvents();
  }

  // ==================== DATA LOADING ====================

  loadOrders(page = 1): void {
    const status = this.statusFilter() || undefined;
    const search = this.searchQuery().trim() || undefined;

    this.orderService.getMyOrders(page, 10, status as OrderStatus, search).subscribe({
      next: (res) => {
        this.currentPage.set(res.pagination.page);
        this.totalPages.set(res.pagination.pages);
        this.totalItems.set(res.pagination.total);
        this.isSearching.set(false);
      },
      error: () => {
        this.isSearching.set(false);
      },
    });
  }

  /**
   * Refreshes the current page with the active filters but without
   * lighting the search spinner. Triggered by relevant FCM push events
   * so the list stays in sync without the user reloading.
   */
  private silentReloadOrders(): void {
    const status = this.statusFilter() || undefined;
    const search = this.searchQuery().trim() || undefined;
    this.orderService.getMyOrders(this.currentPage(), 10, status as OrderStatus, search).subscribe({
      next: (res) => {
        this.currentPage.set(res.pagination.page);
        this.totalPages.set(res.pagination.pages);
        this.totalItems.set(res.pagination.total);
      },
      error: () => { /* silent — polling fallback retries */ },
    });
  }

  /**
   * React to FCM pushes that touch this user's orders (status changes,
   * dispatch updates, mechanic assignments, comments, …) by silently
   * refreshing the current page in place.
   */
  private subscribeToPushEvents(): void {
    this.userNotifications.pushReceived$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const t = event.type || '';
        if (!ORDER_AFFECTING_PUSH_PREFIXES.some((p) => t.startsWith(p))) return;
        this.silentReloadOrders();
      });
  }

  onStatusFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(value as OrderStatus | '');
    this.loadOrders(1);
  }

  /** Fired on every keystroke (pre-debounce) — lights the spinner */
  onSearchTyping(value: string): void {
    if (value !== this.searchQuery()) {
      this.isSearching.set(true);
    }
  }

  /** Fired after debounce — triggers the HTTP request */
  onSearchCommit(value: string): void {
    this.searchQuery.set(value);
    this.loadOrders(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadOrders(page);
  }

  get visiblePages(): number[] {
    const current = this.currentPage();
    const total = this.totalPages();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // ==================== LABELS ====================

  getStatusLabel(status: OrderStatus | string): string {
    return this.statusLabels[status as OrderStatus] || status;
  }

  getStatusClass(status: OrderStatus | string): string {
    return this.statusColors[status as OrderStatus] || '';
  }

  // ==================== NAVIGATION ====================

  viewDetail(order: Order): void {
    this.router.navigate(['/perfil/pedidos', order.id]);
  }

  // ==================== FORMAT HELPERS ====================

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
