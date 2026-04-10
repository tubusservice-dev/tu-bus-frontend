import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { MechanicAssignment, ProgressStep } from '../../../models/mechanic-assignment.model';

@Component({
  selector: 'app-service-tracking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './service-tracking.component.html',
  styleUrl: './service-tracking.component.scss',
})
export class ServiceTrackingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);

  protected readonly orderId = signal('');
  protected readonly assignment = signal<MechanicAssignment | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly noAssignment = signal(false);
  protected readonly fromHistory = signal(false);

  protected readonly mechanicName = computed(() => {
    const a = this.assignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return a.mechanic.name || '';
  });

  protected readonly mechanicWhatsapp = computed(() => {
    const a = this.assignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return a.mechanic.whatsapp || '';
  });

  protected readonly mechanicEmail = computed(() => {
    const a = this.assignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return a.mechanic.email || '';
  });

  protected readonly orderNumber = computed(() => {
    const a = this.assignment();
    if (!a || typeof a.order === 'string') return '';
    return a.order.orderNumber || '';
  });

  protected readonly vehicles = computed(() => {
    const a = this.assignment();
    if (!a || typeof a.order === 'string') return [];
    return (a.order.vehicles || []) as any[];
  });

  protected readonly currentStepIndex = computed(() => {
    const a = this.assignment();
    if (!a) return -1;
    let last = -1;
    for (let i = 0; i < a.progressSteps.length; i++) {
      if (a.progressSteps[i].completedAt) last = i;
    }
    return last;
  });

  protected readonly progressPercent = computed(() => {
    const a = this.assignment();
    if (!a) return 0;
    const total = a.progressSteps.length;
    const completed = a.progressSteps.filter(s => s.completedAt).length;
    return Math.round((completed / total) * 100);
  });

  protected readonly isCompleted = computed(() => this.assignment()?.status === 'completed');
  protected readonly isExpired = computed(() => this.assignment()?.status === 'expired');
  protected readonly isCancelled = computed(() => this.assignment()?.status === 'cancelled');

  protected readonly statusLabel = computed(() => {
    const map: Record<string, string> = {
      scheduled: 'Mecánico asignado',
      en_camino: 'Mecánico en camino',
      in_progress: 'En Servicio',
      completed: 'Servicio completado',
      cancelled: 'Servicio cancelado',
      expired: 'Asignación expirada',
    };
    return map[this.assignment()?.status || ''] || '';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.fromHistory.set(this.route.snapshot.queryParamMap.get('from') === 'history');
    if (id) {
      this.orderId.set(id);
      this.loadTracking(id);
    }
  }

  goBack(): void {
    if (this.fromHistory()) {
      this.router.navigate(['/perfil'], { fragment: 'mecanicos' });
    } else {
      this.router.navigate(['/perfil/pedidos', this.orderId()]);
    }
  }

  private loadTracking(orderId: string): void {
    this.isLoading.set(true);
    this.orderService.getServiceTracking(orderId).subscribe({
      next: (res) => {
        if (res.data) {
          this.assignment.set(res.data);
        } else {
          this.noAssignment.set(true);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.noAssignment.set(true);
        this.isLoading.set(false);
      },
    });
  }
}
