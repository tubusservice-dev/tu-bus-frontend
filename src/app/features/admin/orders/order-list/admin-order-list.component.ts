import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderService } from '../../../../core/services/order.service';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DISPATCH_STATUS_LABELS,
  DISPATCH_STATUS_COLORS,
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

  protected readonly isLoading = signal(true);
  protected readonly orders = signal<Order[]>([]);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalItems = signal(0);
  protected readonly statusFilter = signal<string>('');
  protected readonly searchQuery = signal('');
  private searchTimeout: any = null;
  protected readonly activeTab = signal<'active' | 'history'>('active');

  protected readonly orderStatuses = Object.values(OrderStatus);
  protected readonly ORDER_STATUS_LABELS = ORDER_STATUS_LABELS;

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
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.loadOrders(1), 300);
  }

  switchTab(tab: 'active' | 'history'): void {
    this.activeTab.set(tab);
    this.statusFilter.set('');
    this.loadOrders(1);
  }

  /** Statuses shown per tab */
  get activeStatuses(): OrderStatus[] {
    if (this.activeTab() === 'history') {
      return [OrderStatus.CONFIRMED, OrderStatus.COMPLETED, OrderStatus.CANCELLED];
    }
    return this.orderStatuses;
  }

  /** Filter statuses for the dropdown based on current tab */
  get filterableStatuses(): OrderStatus[] {
    if (this.activeTab() === 'history') {
      return [OrderStatus.CONFIRMED, OrderStatus.COMPLETED, OrderStatus.CANCELLED];
    }
    return this.orderStatuses;
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

  getDispatchStatusLabel(status?: string): string {
    if (!status) return '-';
    return DISPATCH_STATUS_LABELS[status] || status;
  }

  getDispatchStatusColor(status?: string): string {
    if (!status) return '';
    return DISPATCH_STATUS_COLORS[status] || '';
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
