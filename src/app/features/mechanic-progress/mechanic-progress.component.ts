import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MechanicAssignmentService } from '../../core/services/mechanic-assignment.service';
import { MechanicAssignment, ProgressStep } from '../../models/mechanic-assignment.model';

@Component({
  selector: 'app-mechanic-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mechanic-progress.component.html',
  styleUrl: './mechanic-progress.component.scss',
})
export class MechanicProgressComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly assignmentService = inject(MechanicAssignmentService);

  protected readonly assignment = signal<MechanicAssignment | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly isAdvancing = signal(false);
  protected readonly showConfirmModal = signal(false);
  protected readonly showRejectModal = signal(false);
  protected readonly rejectReason = signal('');
  protected readonly isRejecting = signal(false);

  protected readonly currentStepIndex = computed(() => {
    const a = this.assignment();
    if (!a) return -1;
    // Find last completed step
    let lastCompleted = -1;
    for (let i = 0; i < a.progressSteps.length; i++) {
      if (a.progressSteps[i].completedAt) lastCompleted = i;
    }
    return lastCompleted;
  });

  protected readonly nextStep = computed<ProgressStep | null>(() => {
    const a = this.assignment();
    const idx = this.currentStepIndex();
    if (!a || idx >= a.progressSteps.length - 1) return null;
    return a.progressSteps[idx + 1];
  });

  protected readonly isCompleted = computed(() => {
    const a = this.assignment();
    if (!a) return false;
    return a.status === 'completed';
  });

  protected readonly isExpired = computed(() => {
    const a = this.assignment();
    if (!a) return false;
    return a.status === 'expired';
  });

  protected readonly isPaused = computed(() => {
    const a = this.assignment();
    if (!a) return false;
    return a.status === 'paused';
  });

  protected readonly canReject = computed(() => {
    const a = this.assignment();
    if (!a) return false;
    return ['scheduled', 'en_camino', 'in_progress'].includes(a.status);
  });

  protected readonly orderInfo = computed(() => {
    const a = this.assignment();
    if (!a || typeof a.order === 'string') return null;
    return a.order;
  });

  protected readonly mechanicName = computed(() => {
    const a = this.assignment();
    if (!a) return '';
    return typeof a.mechanic === 'object' ? a.mechanic.name : '';
  });

  protected readonly clientName = computed(() => {
    const info = this.orderInfo();
    if (!info || !info.user || typeof info.user === 'string') return '';
    const user = info.user as { firstName?: string; lastName?: string };
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  });

  private readonly STEP_LABELS: Record<string, string> = {
    asignado: 'Asignado',
    en_camino: 'En Camino',
    en_proceso: 'En Servicio',
    completado: 'Completado',
  };

  protected getStepLabel(step: ProgressStep): string {
    return this.STEP_LABELS[step.step] || step.label;
  }

  protected getVehicleLabel(v: any): string {
    return `${v?.marca || ''} ${v?.modelo || ''} - ${v?.placa || ''}`.trim();
  }

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (token) {
      this.loadProgress(token);
    } else {
      this.error.set('Enlace invalido');
      this.isLoading.set(false);
    }
  }

  openConfirmModal(): void {
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
  }

  confirmAdvance(): void {
    this.showConfirmModal.set(false);
    const next = this.nextStep();
    const a = this.assignment();
    if (!next || !a) return;

    this.isAdvancing.set(true);
    this.assignmentService.advanceProgress(a.accessToken, next.step).subscribe({
      next: (res) => {
        this.assignment.set(res.data);
        this.isAdvancing.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al avanzar progreso');
        this.isAdvancing.set(false);
      },
    });
  }

  openRejectModal(): void {
    this.rejectReason.set('');
    this.showRejectModal.set(true);
  }

  closeRejectModal(): void {
    this.showRejectModal.set(false);
  }

  confirmReject(): void {
    const a = this.assignment();
    const reason = this.rejectReason().trim();
    if (!a || !reason) return;

    this.isRejecting.set(true);
    this.assignmentService.rejectByMechanic(a.accessToken, reason).subscribe({
      next: (res) => {
        this.assignment.set(res.data);
        this.isRejecting.set(false);
        this.showRejectModal.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al rechazar asignación');
        this.isRejecting.set(false);
      },
    });
  }

  private loadProgress(token: string): void {
    this.isLoading.set(true);
    this.assignmentService.getProgressByToken(token).subscribe({
      next: (res) => {
        this.assignment.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'No se pudo cargar la informacion');
        this.isLoading.set(false);
      },
    });
  }
}
