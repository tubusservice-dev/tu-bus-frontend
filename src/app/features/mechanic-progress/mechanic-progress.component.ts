import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MechanicAssignmentService } from '../../core/services/mechanic-assignment.service';
import { ThemeService } from '../../core/services/theme.service';
import { MechanicAssignment, ProgressStep, BranchContactInfo } from '../../models/mechanic-assignment.model';
import { SupportContactConfig } from '../../models/settings.model';
import { environment } from '../../../environments/environment';
import { MechanicAvatarComponent } from '../../shared/components/mechanic-avatar/mechanic-avatar.component';

@Component({
  selector: 'app-mechanic-progress',
  standalone: true,
  imports: [CommonModule, MechanicAvatarComponent],
  templateUrl: './mechanic-progress.component.html',
  styleUrl: './mechanic-progress.component.scss',
})
export class MechanicProgressComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly assignmentService = inject(MechanicAssignmentService);
  protected readonly themeService = inject(ThemeService);

  protected readonly assignment = signal<MechanicAssignment | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly isAdvancing = signal(false);
  protected readonly showConfirmModal = signal(false);
  protected readonly showRejectModal = signal(false);
  protected readonly rejectReason = signal('');
  protected readonly isRejecting = signal(false);

  // Contextual modal content — set based on the next step before opening
  protected readonly confirmModalTitle = signal('Confirmar avance');
  protected readonly confirmModalDescription = signal('');
  protected readonly confirmModalButtonLabel = signal('Confirmar');
  protected readonly confirmModalIsFinal = signal(false);

  // Map each step to its contextual modal content
  private readonly STEP_MODAL_CONTENT: Record<string, { title: string; description: string; button: string; final: boolean }> = {
    en_camino: {
      title: 'Confirmar que estas en camino',
      description: 'Al confirmar, el cliente sera notificado de que te encuentras en camino a su ubicacion.',
      button: 'Si, voy en camino',
      final: false,
    },
    en_proceso: {
      title: 'Iniciar el servicio',
      description: 'Al confirmar, el cliente sera notificado de que el servicio de cambio de aceite ha comenzado.',
      button: 'Iniciar servicio',
      final: false,
    },
    completado: {
      title: 'Completar el servicio',
      description: 'Al confirmar, el servicio se marcara como completado. Esta accion no se puede deshacer.',
      button: 'Completar servicio',
      final: true,
    },
  };

  // Support modal state
  protected readonly showSupportModal = signal(false);
  protected readonly supportContact = signal<SupportContactConfig | null>(null);
  protected readonly branchContact = signal<BranchContactInfo | null>(null);
  protected readonly activePhonePopover = signal<string | null>(null);

  protected readonly currentStepIndex = computed(() => {
    const a = this.assignment();
    if (!a) return -1;
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

  protected readonly mechanicAvatar = computed(() => {
    const a = this.assignment();
    if (!a) return '';
    return typeof a.mechanic === 'object' ? (a.mechanic as any).avatar || '' : '';
  });

  protected readonly clientName = computed(() => {
    const info = this.orderInfo();
    if (!info || !info.user || typeof info.user === 'string') return '';
    const user = info.user as { firstName?: string; lastName?: string };
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  });

  protected readonly hasSupportInfo = computed(() => {
    const admin = this.supportContact();
    const branch = this.branchContact();
    const hasAdmin = !!admin && (!!admin.phone || !!admin.email);
    const hasBranch = !!branch && (!!branch.whatsappPhone || !!branch.landlinePhone);
    return hasAdmin || hasBranch;
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
    this.loadSupportContact();
  }

  // ========== Support Modal ==========
  openSupportModal(): void {
    this.showSupportModal.set(true);
    this.activePhonePopover.set(null);
  }

  closeSupportModal(): void {
    this.showSupportModal.set(false);
    this.activePhonePopover.set(null);
  }

  togglePhonePopover(id: string): void {
    this.activePhonePopover.update((current) => (current === id ? null : id));
  }

  closePopovers(): void {
    this.activePhonePopover.set(null);
  }

  /** Strip non-digits and normalize to international (58...) form.
   *  Accepts local `04XXXXXXXXXX`, international `+58412...` or bare digits. */
  private toInternationalDigits(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return '58' + digits.substring(1);
    return digits;
  }

  openWhatsApp(phone: string): void {
    const international = this.toInternationalDigits(phone);
    if (!international) return;
    window.open(`https://wa.me/${international}`, '_blank');
    this.activePhonePopover.set(null);
  }

  callPhone(phone: string): void {
    const international = this.toInternationalDigits(phone);
    if (!international) return;
    window.open(`tel:+${international}`, '_self');
    this.activePhonePopover.set(null);
  }

  // ========== Advance/Reject ==========
  openConfirmModal(): void {
    const next = this.nextStep();
    if (!next) return;

    const content = this.STEP_MODAL_CONTENT[next.step];
    if (content) {
      this.confirmModalTitle.set(content.title);
      this.confirmModalDescription.set(content.description);
      this.confirmModalButtonLabel.set(content.button);
      this.confirmModalIsFinal.set(content.final);
    } else {
      // Fallback for any unexpected step name
      this.confirmModalTitle.set('Confirmar avance');
      this.confirmModalDescription.set(`Deseas avanzar al siguiente paso: ${this.getStepLabel(next)}?`);
      this.confirmModalButtonLabel.set('Confirmar');
      this.confirmModalIsFinal.set(false);
    }
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

  // ========== Private ==========
  private loadProgress(token: string): void {
    this.isLoading.set(true);
    this.assignmentService.getProgressByToken(token).subscribe({
      next: (res) => {
        this.assignment.set(res.data);
        if (res.data.branch) {
          this.branchContact.set(res.data.branch);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'No se pudo cargar la informacion');
        this.isLoading.set(false);
      },
    });
  }

  private loadSupportContact(): void {
    this.http
      .get<{ success: boolean; data: { supportContact: SupportContactConfig } }>(
        `${environment.apiUrl}/settings`
      )
      .subscribe({
        next: (res) => {
          if (res.data?.supportContact) {
            this.supportContact.set(res.data.supportContact);
          }
        },
        error: () => {
          // Silently fail — support info is optional
        },
      });
  }
}
