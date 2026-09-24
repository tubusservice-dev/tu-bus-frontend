import { Component, inject, signal, computed, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MechanicAssignmentService } from '@core/services/mechanic-assignment.service';
import { MechanicService } from '@core/services/mechanic.service';
import { OrderService } from '@core/services/order.service';
import { AvailableSlot, MechanicAssignment } from '@models/mechanic-assignment.model';
import { Mechanic } from '@models/mechanic.model';
import {
  Order,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  OrderStatus,
  ServiceDateTier,
} from '@models/order.model';
import { MechanicAvatarComponent } from '@shared/components/mechanic-avatar/mechanic-avatar.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { SlotsSuggestionsComponent } from '../slots-suggestions/slots-suggestions.component';
import { toWhatsAppDigits } from '@shared/utils/phone.util';
import { businessTodayIso, businessIsoOffset, formatBusinessDate } from '@shared/utils/business-date.util';

@Component({
  selector: 'app-order-dispatch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MechanicAvatarComponent, DateInputComponent, SlotsSuggestionsComponent],
  templateUrl: './order-dispatch-modal.component.html',
  styleUrl: './order-dispatch-modal.component.scss',
})
export class OrderDispatchModalComponent {
  private readonly mechanicAssignmentService = inject(MechanicAssignmentService);
  private readonly mechanicService = inject(MechanicService);
  private readonly orderService = inject(OrderService);

  readonly order = input<Order | null>(null);
  readonly isOpen = input<boolean>(false);
  readonly close = output<void>();
  readonly assigned = output<Order>();
  readonly rescheduled = output<Order>();

  protected readonly isAssigning = signal(false);
  protected readonly isLoadingMechanics = signal(true);
  protected readonly isLoadingAssignment = signal(false);
  protected readonly assignError = signal<string | null>(null);
  protected readonly linkCopied = signal(false);
  protected readonly branchMechanics = signal<Mechanic[]>([]);
  protected readonly selectedMechanic = signal<Mechanic | null>(null);
  protected readonly currentAssignment = signal<MechanicAssignment | null>(null);
  protected readonly progressLink = signal<string>('');
  protected readonly availabilityStatus = signal<'unchecked' | 'checking' | 'available' | 'conflict' | 'outside'>('unchecked');
  protected readonly isCancellingAssignment = signal(false);

  // Reschedule state
  protected readonly isRescheduling = signal(false);
  protected readonly isSavingReschedule = signal(false);
  protected readonly rescheduleError = signal<string | null>(null);
  protected rescheduleNote = '';

  // When the customer locked a date on checkout, the admin picks only the
  // hour — the date is frozen and prefilled here.
  protected readonly requestedDateIso = computed(() => {
    const raw = this.order()?.requestedServiceDate;
    if (!raw) return '';
    return this.toIsoDate(raw);
  });

  protected readonly requestedDateTier = computed(() =>
    this.order()?.requestedServiceTier ?? null
  );

  protected readonly hasRequestedDate = computed(() => !!this.requestedDateIso());

  protected selectedMechanicId = '';
  protected readonly selectedDateSignal = signal('');
  protected readonly selectedTimeSignal = signal('');
  protected readonly todayStr = businessTodayIso();

  protected get selectedDate(): string { return this.selectedDateSignal(); }
  protected set selectedDate(val: string) { this.selectedDateSignal.set(val); }
  protected get selectedStartTime(): string { return this.selectedTimeSignal(); }
  protected set selectedStartTime(val: string) { this.selectedTimeSignal.set(val); }

  protected readonly isDatePast = computed(() => {
    const d = this.selectedDateSignal();
    if (!d) return false;
    return d < this.todayStr;
  });

  protected readonly isTimeInPast = computed(() => {
    const d = this.selectedDateSignal();
    const t = this.selectedTimeSignal();
    if (!d || !t || d !== this.todayStr) return false;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    return this.timeToMinutes(t) < currentMin;
  });

  protected readonly calculatedEndTime = computed(() => {
    const mech = this.selectedMechanic();
    const t = this.selectedTimeSignal();
    if (!mech || !t) return '';
    const endMin = this.timeToMinutes(t) + (mech.serviceDurationMinutes || 90);
    return this.minutesToTime(endMin);
  });

  constructor() {
    effect(() => {
      const currentOrder = this.order();
      if (currentOrder && this.isOpen()) {
        this.loadAssignment(currentOrder);
        this.loadBranchMechanics(currentOrder);
        this.applyRequestedServiceDate();
      }
    });
  }

  private applyRequestedServiceDate(): void {
    const iso = this.requestedDateIso();
    if (!iso) return;
    if (!this.selectedDateSignal()) {
      this.selectedDateSignal.set(iso);
    }
  }

  /** YYYY-MM-DD normalizer — accepts ISO strings or Date instances from the API. */
  private toIsoDate(raw: string | Date): string {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${d.getUTCDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  protected requestedDateLabel(): string {
    return formatBusinessDate(this.requestedDateIso(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  protected requestedTierLabel(): string {
    const tier = this.requestedDateTier();
    switch (tier) {
      case 'express':   return 'Express (hoy)';
      case 'tomorrow':  return 'Mañana';
      case 'scheduled': return 'Agendado por el cliente';
      default:          return '';
    }
  }

  protected onSlotPicked(slot: AvailableSlot): void {
    this.selectedTimeSignal.set(slot.startTime);
    this.onTimeChange();
  }

  protected onSlotCleared(): void {
    this.selectedTimeSignal.set('');
    this.availabilityStatus.set('unchecked');
  }

  selectMechanic(mech: Mechanic): void {
    this.selectedMechanicId = mech.id;
    this.selectedMechanic.set(mech);
    this.selectedDate = '';
    this.selectedStartTime = '';
    this.availabilityStatus.set('unchecked');
  }

  onDateChange(): void {
    this.selectedStartTime = '';
    this.availabilityStatus.set('unchecked');
  }

  onTimeChange(): void {
    this.availabilityStatus.set('unchecked');
    this.checkTimeAvailability();
  }

  private checkTimeAvailability(): void {
    const mech = this.selectedMechanic();
    if (!mech || !this.selectedDate || !this.selectedStartTime) return;
    if (this.isDatePast() || this.isTimeInPast()) return;

    // Check if within schedule (parse parts to avoid UTC timezone shift)
    const [y, m, d] = this.selectedDate.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const schedule = mech.schedule?.find(s => s.day === dayOfWeek);
    if (!schedule || schedule.isClosed) {
      this.availabilityStatus.set('outside');
      return;
    }

    const startMin = this.timeToMinutes(this.selectedStartTime);
    const endMin = startMin + (mech.serviceDurationMinutes || 90);
    const openMin = this.timeToMinutes(schedule.openTime);
    const closeMin = this.timeToMinutes(schedule.closeTime);

    if (startMin < openMin || endMin > closeMin) {
      this.availabilityStatus.set('outside');
      return;
    }

    // Call backend to verify availability
    this.availabilityStatus.set('checking');
    const endTime = this.minutesToTime(endMin);

    this.mechanicAssignmentService
      .getAvailableMechanics(this.selectedDate, this.selectedStartTime, endTime, undefined, this.order()?.id)
      .subscribe({
        next: (res) => {
          const found = res.data.some(m => m.id === mech.id);
          this.availabilityStatus.set(found ? 'available' : 'conflict');
        },
        error: () => this.availabilityStatus.set('conflict'),
      });
  }

  createAssignment(): void {
    const order = this.order();
    if (!order || !this.selectedMechanicId || !this.selectedStartTime) return;

    this.isAssigning.set(true);
    this.assignError.set(null);

    this.mechanicAssignmentService.createAssignment({
      mechanicId: this.selectedMechanicId,
      orderId: order.id,
      scheduledDate: this.selectedDate,
      startTime: this.selectedStartTime,
    }).subscribe({
      next: (res) => {
        this.currentAssignment.set(res.data);
        const clientUrl = window.location.origin;
        this.progressLink.set(`${clientUrl}/mechanic/progress/${res.data.accessToken}`);
        this.isAssigning.set(false);
        this.assigned.emit(order);
      },
      error: (err) => {
        this.isAssigning.set(false);
        this.assignError.set(err.error?.message || 'Error al crear asignacion');
      },
    });
  }

  cancelCurrentAssignment(): void {
    const a = this.currentAssignment();
    if (!a) return;
    this.isCancellingAssignment.set(true);
    this.mechanicAssignmentService.cancelAssignment(a.id, 'Cancelado por administrador para reasignación').subscribe({
      next: () => {
        this.isCancellingAssignment.set(false);
        this.currentAssignment.set(null);
        this.progressLink.set('');
        // Reload branch mechanics for new assignment
        const order = this.order();
        if (order) this.loadBranchMechanics(order);
      },
      error: () => this.isCancellingAssignment.set(false),
    });
  }

  copyLink(): void {
    const link = this.progressLink();
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  getAssignedMechanicName(): string {
    const a = this.currentAssignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return a.mechanic.name || '';
  }

  getAssignedMechanicWhatsapp(): string {
    const a = this.currentAssignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return a.mechanic.whatsapp || '';
  }

  getAssignedMechanicAvatar(): string {
    const a = this.currentAssignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return (a.mechanic as any).avatar || '';
  }

  getMechanicAvatar(mech: any): string {
    return mech?.avatar || '';
  }

  /**
   * Format the assignment's scheduled date in long Spanish form, e.g.
   * "Miércoles, 15 de abril de 2026".
   */
  getFormattedScheduledDate(): string {
    const a = this.currentAssignment();
    if (!a?.scheduledDate) return '';
    return formatBusinessDate(a.scheduledDate, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  getWhatsAppUrl(): string {
    const assignment = this.currentAssignment();
    const order = this.order();
    if (!assignment) return '';

    const mechanic = assignment.mechanic as any;
    const phone = mechanic?.whatsapp || '';
    const cleanPhone = toWhatsAppDigits(phone);
    if (!cleanPhone) return '';
    const link = this.progressLink();
    const clientName = order?.dispatchDetails?.recipientName || 'Cliente';
    const address = order?.dispatchDetails?.recipientAddress || '';
    const city = order?.dispatchDetails?.recipientCity || '';
    const scheduledDate = formatBusinessDate(assignment.scheduledDate, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const lines = [
      `*TuBus Express - Servicio de Cambio de Aceite*`,
      ``,
      `Hola ${mechanic?.name}, se te ha asignado un servicio:`,
      ``,
      `*Cliente:* ${clientName}`,
      address ? `*Direccion:* ${address}${city ? ', ' + city : ''}` : '',
      `*Fecha:* ${scheduledDate}`,
      `*Horario:* ${assignment.startTime} - ${assignment.endTime}`,
      ``,
      `*Link de progreso:*`,
      link,
    ].filter(Boolean).join('\n');

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`;
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status as OrderStatus] || status;
  }

  getStatusColor(status: string): string {
    return ORDER_STATUS_COLORS[status as OrderStatus] || '';
  }

  onClose(): void {
    this.currentAssignment.set(null);
    this.selectedMechanic.set(null);
    this.branchMechanics.set([]);
    this.availabilityStatus.set('unchecked');
    this.selectedMechanicId = '';
    // Keep date if the client locked it — the effect() repopulates on reopen
    this.selectedDate = '';
    this.selectedStartTime = '';
    this.cancelRescheduling();
    this.close.emit();
  }

  // ==================== RESCHEDULE ====================

  protected startRescheduling(): void {
    this.isRescheduling.set(true);
    this.rescheduleError.set(null);
    this.rescheduleNote = '';
    // selectedDate already holds the current requestedServiceDate thanks to the effect
  }

  /**
   * Derives the service tier from a date relative to today, with comparisons
   * anchored to the business calendar so a late-evening session does not
   * misclassify "today" or "tomorrow".
   */
  private deriveTierFromDate(iso: string): ServiceDateTier {
    if (!iso) return 'scheduled';
    if (iso === this.todayStr) return 'express';
    if (iso === businessIsoOffset(1)) return 'tomorrow';
    return 'scheduled';
  }

  protected cancelRescheduling(): void {
    this.isRescheduling.set(false);
    this.isSavingReschedule.set(false);
    this.rescheduleError.set(null);
    this.rescheduleNote = '';
    // Reset selectedDate back to the client's requested date
    this.selectedDate = this.requestedDateIso();
  }

  protected canSaveReschedule(): boolean {
    return !!this.selectedDate && !this.isDatePast();
  }

  protected saveReschedule(): void {
    const order = this.order();
    if (!order) return;
    if (!this.canSaveReschedule()) return;

    this.isSavingReschedule.set(true);
    this.rescheduleError.set(null);

    this.orderService.rescheduleService(order.id, {
      newDate: this.selectedDate,
      newTier: this.deriveTierFromDate(this.selectedDate),
      adminNote: this.rescheduleNote.trim(),
    }).subscribe({
      next: (res) => {
        this.isSavingReschedule.set(false);
        this.isRescheduling.set(false);
        this.rescheduled.emit(res.data as any);
      },
      error: (err) => {
        this.isSavingReschedule.set(false);
        this.rescheduleError.set(err?.error?.message || 'No se pudo reprogramar la fecha');
      },
    });
  }

  private loadAssignment(order: Order): void {
    const hasMechanic = order.mechanicAssignment
      || (order.mechanic && typeof order.mechanic === 'object');

    if (hasMechanic) {
      this.isLoadingAssignment.set(true);
      this.mechanicAssignmentService.getByOrder(order.id).subscribe({
        next: (res) => {
          const active = res.data.find(a => !['cancelled', 'expired'].includes(a.status));
          if (active) {
            this.currentAssignment.set(active);
            const clientUrl = window.location.origin;
            this.progressLink.set(`${clientUrl}/mechanic/progress/${active.accessToken}`);
          }
          this.isLoadingAssignment.set(false);
        },
        error: () => {
          this.isLoadingAssignment.set(false);
        },
      });
    }
  }

  private loadBranchMechanics(order: Order): void {
    this.isLoadingMechanics.set(true);
    const branchId = order.dispatchDetails?.selectedBranchId;

    // Load all active mechanics, optionally filtered by branch
    this.mechanicService.getAll(1, 100).subscribe({
      next: (res) => {
        let mechanics = res.data.filter(m => m.isActive);

        // Filter by branch if order has one
        if (branchId) {
          mechanics = mechanics.filter(m =>
            (m.branches || []).some(b => {
              const bid = typeof b === 'object' && b ? b.id : String(b);
              return bid === branchId;
            })
          );
        }

        this.branchMechanics.set(mechanics);
        this.isLoadingMechanics.set(false);
      },
      error: () => this.isLoadingMechanics.set(false),
    });
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}
