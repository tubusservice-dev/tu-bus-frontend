import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { MechanicAssignment, ProgressStep } from '../../../models/mechanic-assignment.model';

type StepKey = 'asignado' | 'en_camino' | 'en_proceso' | 'completado';

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

  // ========== ESTADO ==========
  protected readonly orderId = signal('');
  protected readonly assignment = signal<MechanicAssignment | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly noAssignment = signal(false);
  protected readonly fromHistory = signal(false);

  // ========== POPOVER TELÉFONO ==========
  protected readonly activePhonePopover = signal<string | null>(null);

  // Labels canónicos de pasos
  private readonly STEP_LABELS: Record<StepKey, string> = {
    asignado: 'Asignado',
    en_camino: 'En camino',
    en_proceso: 'En servicio',
    completado: 'Completado',
  };

  // ========== COMPUTEDS ==========
  protected readonly orderNumber = computed(() => {
    const a = this.assignment();
    if (!a) return '';
    const order = a.order as any;
    return (order && typeof order === 'object') ? (order.orderNumber || '') : '';
  });

  protected readonly mechanicName = computed(() => {
    const a = this.assignment();
    if (!a) return '';
    const m = a.mechanic as any;
    if (m && typeof m === 'object' && m.name) return m.name;
    return 'Mecánico asignado';
  });

  protected readonly mechanicWhatsapp = computed(() => {
    const a = this.assignment();
    if (!a) return '';
    const m = a.mechanic as any;
    if (m && typeof m === 'object' && m.whatsapp) return m.whatsapp;
    return '';
  });

  protected readonly mechanicInitial = computed(() => {
    const name = this.mechanicName();
    return (name && name !== 'Mecánico asignado') ? name.charAt(0).toUpperCase() : 'M';
  });

  protected readonly vehicles = computed(() => {
    const a = this.assignment();
    if (!a) return [] as any[];
    const order = a.order as any;
    if (!order || typeof order !== 'object') return [];
    return (order.vehicles || []) as any[];
  });

  protected readonly dispatchDetails = computed(() => {
    const a = this.assignment();
    if (!a) return null;
    const order = a.order as any;
    if (!order || typeof order !== 'object') return null;
    return order.dispatchDetails || null;
  });

  protected readonly progressSteps = computed(() => {
    const a = this.assignment();
    if (!a) return [] as ProgressStep[];
    return a.progressSteps || [];
  });

  protected readonly currentStepIndex = computed(() => {
    const steps = this.progressSteps();
    let last = -1;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].completedAt) last = i;
    }
    return last;
  });

  protected readonly progressPercent = computed(() => {
    const steps = this.progressSteps();
    if (!steps.length) return 0;
    const completed = steps.filter((s) => s.completedAt).length;
    return Math.round((completed / steps.length) * 100);
  });

  protected readonly isCompleted = computed(() => this.assignment()?.status === 'completed');
  protected readonly isExpired = computed(() => this.assignment()?.status === 'expired');
  protected readonly isCancelled = computed(() => this.assignment()?.status === 'cancelled');
  protected readonly isPaused = computed(() => this.assignment()?.status === 'paused');

  /** Paso actual con su label visual */
  protected readonly currentStepLabel = computed(() => {
    const steps = this.progressSteps();
    const a = this.assignment();
    if (!a) return '';

    // Si está completado, el label es "Completado"
    if (a.status === 'completed') return 'Servicio completado';
    if (a.status === 'expired') return 'Asignación expirada';
    if (a.status === 'cancelled') return 'Servicio cancelado';
    if (a.status === 'paused') return 'Servicio pausado';

    const idx = this.currentStepIndex();
    const nextIdx = idx + 1;

    // Si hay un paso pendiente, mostrar ESE como el próximo
    if (nextIdx < steps.length) {
      const stepKey = steps[nextIdx].step as StepKey;
      const label = this.STEP_LABELS[stepKey] || steps[nextIdx].label || 'En progreso';
      return `Próximo: ${label}`;
    }

    // Todos los pasos completados
    return 'Servicio completado';
  });

  /** Descripción amigable del estado */
  protected readonly statusDescription = computed(() => {
    const a = this.assignment();
    if (!a) return '';
    const descriptions: Record<string, string> = {
      scheduled: 'El mecánico fue asignado y pronto se pondrá en camino.',
      en_camino: 'El mecánico se encuentra en camino a tu ubicación.',
      in_progress: 'El mecánico está realizando el servicio en tu vehículo.',
      completed: 'El servicio de cambio de aceite se completó exitosamente.',
      cancelled: 'Este servicio fue cancelado.',
      expired: 'La asignación expiró. Se procederá a reasignar el servicio.',
      paused: 'El servicio está pausado temporalmente.',
    };
    return descriptions[a.status] || '';
  });

  protected readonly scheduledDateFormatted = computed(() => {
    const a = this.assignment();
    if (!a || !a.scheduledDate) return '—';
    const date = new Date(a.scheduledDate);
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  });

  protected readonly timeRangeFormatted = computed(() => {
    const a = this.assignment();
    if (!a) return '—';
    const start = a.startTime || '--:--';
    const end = a.endTime || '--:--';
    return `${start} - ${end}`;
  });

  // ========== CICLO DE VIDA ==========
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.fromHistory.set(this.route.snapshot.queryParamMap.get('from') === 'history');
    if (id) {
      this.orderId.set(id);
      this.loadTracking(id);
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

  // ========== NAVEGACIÓN ==========
  goBack(): void {
    if (this.fromHistory()) {
      this.router.navigate(['/perfil'], { fragment: 'mecanicos' });
    } else {
      this.router.navigate(['/perfil/pedidos', this.orderId()]);
    }
  }

  // ========== LABEL DE STEP ==========
  getStepLabel(step: ProgressStep): string {
    const key = step.step as StepKey;
    return this.STEP_LABELS[key] || step.label || key;
  }

  formatStepTime(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' · ' +
           d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  // ========== POPOVERS TELÉFONO ==========
  togglePhonePopover(id: string, event: Event): void {
    event.stopPropagation();
    this.activePhonePopover.update((current) => (current === id ? null : id));
  }

  closePopovers(): void {
    this.activePhonePopover.set(null);
  }

  openWhatsApp(phone: string): void {
    if (!phone) return;
    const cleaned = phone.replace(/-/g, '').replace(/\s/g, '');
    const international = '58' + cleaned.replace(/^0/, '');
    window.open(`https://wa.me/${international}`, '_blank');
    this.activePhonePopover.set(null);
  }

  callPhone(phone: string): void {
    if (!phone) return;
    const cleaned = phone.replace(/-/g, '').replace(/\s/g, '');
    const international = '+58' + cleaned.replace(/^0/, '');
    window.open(`tel:${international}`, '_self');
    this.activePhonePopover.set(null);
  }
}
