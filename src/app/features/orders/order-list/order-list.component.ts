import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderService } from '../../../core/services/order.service';
import {
  Order, OrderStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
} from '../../../models/order.model';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
})
export class OrderListComponent implements OnInit {
  protected readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchSubject$ = new Subject<string>();

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
    { value: OrderStatus.CONFIRMED, label: 'Confirmadas' },
    { value: OrderStatus.PROCESSING, label: 'En Proceso' },
    { value: OrderStatus.SHIPPED, label: 'Enviadas' },
    { value: OrderStatus.COMPLETED, label: 'Completadas' },
    { value: OrderStatus.CANCELLED, label: 'Canceladas' },
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

  // ==================== DATA LOADING ====================

  loadOrders(page = 1): void {
    const status = this.statusFilter() || undefined;
    const search = this.searchQuery().trim() || undefined;

    this.orderService.getMyOrders(page, 10, status as OrderStatus, search).subscribe({
      next: (res) => {
        this.currentPage.set(res.pagination.page);
        this.totalPages.set(res.pagination.pages);
        this.totalItems.set(res.pagination.total);
      },
    });
  }

  onStatusFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(value as OrderStatus | '');
    this.loadOrders(1);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchSubject$.next(value);
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
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
