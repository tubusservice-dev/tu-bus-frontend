import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MechanicService } from '../../../../core/services/mechanic.service';
import { MechanicAssignmentService } from '../../../../core/services/mechanic-assignment.service';
import { Mechanic } from '../../../../models/mechanic.model';
import { MechanicAssignment, AssignmentStatus } from '../../../../models/mechanic-assignment.model';

@Component({
  selector: 'app-mechanic-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mechanic-detail.component.html',
  styleUrl: './mechanic-detail.component.scss',
})
export class MechanicDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly mechanicService = inject(MechanicService);
  private readonly assignmentService = inject(MechanicAssignmentService);

  protected readonly mechanic = signal<Mechanic | null>(null);
  protected readonly assignments = signal<MechanicAssignment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly activeFilter = signal<'all' | AssignmentStatus>('all');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 5;
  protected readonly selectedAssignment = signal<MechanicAssignment | null>(null);
  protected readonly showDetailModal = signal(false);
  protected readonly showCancelConfirm = signal(false);
  protected readonly isCancelling = signal(false);

  protected readonly filteredAssignments = computed(() => {
    const filter = this.activeFilter();
    const all = this.assignments();
    if (filter === 'all') return all;
    if (filter === 'in_progress') return all.filter(a => a.status === 'in_progress' || a.status === 'en_camino');
    return all.filter(a => a.status === filter);
  });

  protected readonly totalPages = computed(() => Math.ceil(this.filteredAssignments().length / this.pageSize) || 1);

  protected readonly paginatedAssignments = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredAssignments().slice(start, start + this.pageSize);
  });

  protected readonly stats = computed(() => {
    const all = this.assignments();
    return {
      total: all.length,
      scheduled: all.filter(a => a.status === 'scheduled').length,
      inProgress: all.filter(a => a.status === 'in_progress' || a.status === 'en_camino').length,
      completed: all.filter(a => a.status === 'completed').length,
      cancelled: all.filter(a => a.status === 'cancelled').length,
      expired: all.filter(a => a.status === 'expired').length,
    };
  });

  protected readonly filters: { key: 'all' | AssignmentStatus; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'scheduled', label: 'Programadas' },
    { key: 'in_progress', label: 'En Servicio' },
    { key: 'completed', label: 'Completadas' },
    { key: 'expired', label: 'Expiradas' },
    { key: 'cancelled', label: 'Canceladas' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadData(id);
  }

  setFilter(key: 'all' | AssignmentStatus): void {
    this.activeFilter.set(key);
    this.currentPage.set(1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update(p => p - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1);
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      scheduled: 'Programado', en_camino: 'En Camino', in_progress: 'En Servicio',
      completed: 'Completado', cancelled: 'Cancelado', expired: 'Expirada', paused: 'En Pausa',
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      scheduled: 'badge-blue', en_camino: 'badge-yellow', in_progress: 'badge-orange',
      completed: 'badge-green', cancelled: 'badge-gray', expired: 'badge-red', paused: 'badge-amber',
    };
    return map[status] || 'badge-gray';
  }

  getOrderNumber(a: MechanicAssignment): string {
    return typeof a.order === 'object' && a.order ? a.order.orderNumber : '';
  }

  getOrderTotal(a: MechanicAssignment): number {
    return typeof a.order === 'object' && a.order ? (a.order.total || 0) : 0;
  }

  openDetail(a: MechanicAssignment): void {
    this.selectedAssignment.set(a);
    this.showDetailModal.set(true);
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedAssignment.set(null);
  }

  isAssignmentActive(a: MechanicAssignment): boolean {
    return ['scheduled', 'en_camino', 'in_progress', 'paused'].includes(a.status);
  }

  getOrderId(a: MechanicAssignment): string {
    if (typeof a.order === 'object' && a.order) return a.order.id || '';
    return String(a.order || '');
  }

  openCancelConfirm(): void {
    this.showCancelConfirm.set(true);
  }

  closeCancelConfirm(): void {
    this.showCancelConfirm.set(false);
  }

  confirmCancelAssignment(): void {
    const a = this.selectedAssignment();
    if (!a) return;
    this.isCancelling.set(true);
    this.assignmentService.cancelAssignment(a.id, 'Cancelado por administrador desde detalle del mecánico').subscribe({
      next: () => {
        this.isCancelling.set(false);
        this.showCancelConfirm.set(false);
        this.closeDetail();
        // Reload data
        const id = this.route.snapshot.paramMap.get('id');
        if (id) this.loadData(id);
      },
      error: () => this.isCancelling.set(false),
    });
  }

  getDispatchDetail(a: MechanicAssignment, field: string): string {
    if (typeof a.order !== 'object' || !a.order) return '';
    const details = (a.order as any).dispatchDetails;
    return details?.[field] || '';
  }

  getVehicles(a: MechanicAssignment): any[] {
    if (typeof a.order !== 'object' || !a.order) return [];
    return (a.order as any).vehicles || [];
  }

  getBranchNames(mechanic: Mechanic): string[] {
    return (mechanic.branches || [])
      .map(b => typeof b === 'object' && b ? b.name : '')
      .filter(Boolean) as string[];
  }

  private loadData(id: string): void {
    this.isLoading.set(true);
    this.mechanicService.getById(id).subscribe({ next: (res) => this.mechanic.set(res.data) });
    this.assignmentService.getAllByMechanic(id).subscribe({
      next: (res) => { this.assignments.set(res.data); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
  }
}
