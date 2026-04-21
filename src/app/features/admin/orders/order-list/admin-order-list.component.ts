import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderService } from '../../../../core/services/order.service';
import {
  Order,
  OrderStatus,
  DispatchType,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DISPATCH_TYPE_LABELS,
  DISPATCH_TYPE_COLORS,
  DISPATCH_STATUS_LABELS,
  DISPATCH_STATUS_COLORS,
} from '../../../../models/order.model';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';

@Component({
  selector: 'app-admin-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchInputComponent],
  templateUrl: './admin-order-list.component.html',
  styleUrl: './admin-order-list.component.scss',
})
export class AdminOrderListComponent implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(true);
  protected readonly isSearching = signal(false);
  protected readonly orders = signal<Order[]>([]);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalItems = signal(0);
  protected readonly statusFilter = signal<string>('');
  protected readonly searchQuery = signal('');

  protected readonly ORDER_STATUS_LABELS = ORDER_STATUS_LABELS;
  protected readonly DISPATCH_TYPE_LABELS = DISPATCH_TYPE_LABELS;
  protected readonly DISPATCH_STATUS_LABELS = DISPATCH_STATUS_LABELS;

  /** Only the 5 order-status values are filterable */
  protected readonly adminFilterStatuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.APPROVED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLATION_REQUESTED,
    OrderStatus.CANCELLED,
  ];

  ngOnInit(): void {
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
        this.isSearching.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.isSearching.set(false);
      },
    });
  }

  onStatusFilterChange(): void {
    this.loadOrders(1);
  }

  onSearchTyping(value: string): void {
    if (value !== this.searchQuery()) {
      this.isSearching.set(true);
    }
  }

  onSearchCommit(value: string): void {
    this.searchQuery.set(value);
    this.loadOrders(1);
  }

  get filterableStatuses(): OrderStatus[] {
    return this.adminFilterStatuses;
  }

  // ==================== DATA HELPERS ====================

  getClientName(order: Order): string {
    if (typeof order.user === 'object' && order.user) {
      const name = `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim();
      return name || order.user.email || '-';
    }
    return String(order.user || '-');
  }

  getClientEmail(order: Order): string {
    if (typeof order.user === 'object' && order.user) {
      return order.user.email || '';
    }
    return '';
  }

  getItemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getStatusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  getStatusColor(status: OrderStatus): string {
    return ORDER_STATUS_COLORS[status] || '';
  }

  getDispatchTypeLabel(type: string): string {
    return DISPATCH_TYPE_LABELS[type as DispatchType] || type;
  }

  getDispatchTypeColor(type: string): string {
    return DISPATCH_TYPE_COLORS[type as DispatchType] || '';
  }

  /** Secondary indicator text — dispatch status for shipping orders, service progress for oil change */
  getSecondaryIndicator(order: Order): { label: string; color: string } | null {
    if (order.dispatchStatus) {
      return {
        label: DISPATCH_STATUS_LABELS[order.dispatchStatus],
        color: DISPATCH_STATUS_COLORS[order.dispatchStatus],
      };
    }
    if (order.mechanicAssignment && typeof order.mechanicAssignment === 'object') {
      const assignment = order.mechanicAssignment as any;
      const statusMap: Record<string, { label: string; color: string }> = {
        scheduled: { label: 'Mecanico Asignado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
        en_camino: { label: 'En Camino', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
        in_progress: { label: 'En Servicio', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
        completed: { label: 'Servicio Completo', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
      };
      return statusMap[assignment.status] || null;
    }
    return null;
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

  /** Short date variant for list rows: "21/04/26" */
  formatShortDate(date: string): string {
    return new Date(date).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }

  /** Clock portion only: "11:49" */
  formatShortTime(date: string): string {
    return new Date(date).toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /** Requested service date (only home oil change) formatted short. */
  getRequestedServiceInfo(order: Order): { tierLabel: string; tierClass: string; dateLabel: string } | null {
    if (!order.requestedServiceDate || !order.requestedServiceTier) return null;
    const tierMap: Record<string, { label: string; cls: string }> = {
      express:   { label: 'Express',  cls: 'tier-express' },
      tomorrow:  { label: 'Mañana',   cls: 'tier-tomorrow' },
      scheduled: { label: 'Agendado', cls: 'tier-scheduled' },
    };
    const entry = tierMap[order.requestedServiceTier];
    if (!entry) return null;
    const d = new Date(order.requestedServiceDate);
    const dateLabel = d.toLocaleDateString('es-VE', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
    return { tierLabel: entry.label, tierClass: entry.cls, dateLabel };
  }

  viewOrderDetail(order: Order): void {
    this.router.navigate(['/admin/orders', order.id]);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadOrders(page);
  }

  /** Visible pages with ellipsis — mirrors the catalog paginator. */
  getVisiblePages(): (number | '...')[] {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }
}
