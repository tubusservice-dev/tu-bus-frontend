import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import type { RequestedServiceDate, ServiceDateTier } from '@features/checkout/services/checkout.service';
import { businessIsoOffset, formatBusinessDate } from '@shared/utils/business-date.util';
import { branchDayToJsDow, jsDowToBranchDay } from '@shared/utils/branch-day.util';
import type { ScheduleDay } from '@models/branch.model';

/**
 * Buffer mínimo (en minutos) entre la hora actual y el cierre de la
 * sucursal para permitir Express. Cubre 90 min de duración de servicio
 * + ~30 min de traslado del mecánico, lo cual permite Express hasta
 * dos horas antes del cierre.
 */
const EXPRESS_MIN_BUFFER_MINUTES = 120;

/**
 * Three-way service date chooser for the home oil change flow.
 *
 * Options:
 *   · Express (today)
 *   · Tomorrow
 *   · Scheduled — custom date, minimum = today + 2
 *
 * The component is decoupled from CheckoutService so it can be embedded
 * anywhere (summary, edit-order dialogs). It only reports its value upwards
 * and expects the parent to persist it.
 */
@Component({
  selector: 'app-service-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, DateInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-date-picker.component.html',
  styleUrl: './service-date-picker.component.scss',
})
export class ServiceDatePickerComponent {
  readonly initial = input<RequestedServiceDate | null>(null);
  /**
   * Schedule semanal de la sucursal (7 entradas, una por día).
   * Cuando es null el picker actúa permisivamente (no puede validar) y
   * deja la decisión final al backend — esto cubre el caso transitorio
   * en que la sucursal aún no se cargó.
   */
  readonly schedule = input<ScheduleDay[] | null>(null);
  readonly changed = output<RequestedServiceDate | null>();

  protected readonly tier = signal<ServiceDateTier | null>(null);
  protected readonly scheduledDate = signal<string>('');

  protected readonly todayIso = businessIsoOffset(0);
  protected readonly tomorrowIso = businessIsoOffset(1);
  protected readonly minScheduledIso = businessIsoOffset(2);

  protected readonly todayLabel = this.formatHumanDate(this.todayIso);
  protected readonly tomorrowLabel = this.formatHumanDate(this.tomorrowIso);

  protected readonly scheduledLabel = computed(() => {
    const iso = this.scheduledDate();
    return iso ? this.formatHumanDate(iso) : '';
  });

  // ──────────────────────────────────────────────────────────────────────
  // Schedule-aware availability — derived from the branch schedule input.
  // Sin schedule devuelven defaults permisivos para no bloquear cuando aún
  // no se cargó la información de la sucursal.
  // ──────────────────────────────────────────────────────────────────────

  /** Día de la semana actual (0=domingo … 6=sábado) recalculado al construir el computed. */
  private readonly todayDow = computed(() => new Date().getDay());
  private readonly tomorrowDow = computed(() => (this.todayDow() + 1) % 7);

  /** Hora actual expresada en minutos desde medianoche (0..1439). */
  private readonly nowMinutesOfDay = computed(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  /**
   * Encuentra la entrada del schedule que corresponde a un valor de
   * `Date.getDay()`. Convierte primero la convención JS al `day` que
   * usa Branch para localizar la entrada correcta.
   */
  private findScheduleByJsDow(sched: ScheduleDay[], jsDow: number): ScheduleDay | undefined {
    const branchDay = jsDowToBranchDay(jsDow);
    return sched.find((d) => d.day === branchDay);
  }

  /**
   * Días de la semana donde la sucursal está cerrada, expresados ya en
   * convención `Date.getDay()` (lo que el calendar y `new Date(iso).getDay()`
   * esperan).
   */
  protected readonly closedDaysOfWeek = computed<number[]>(() => {
    const sched = this.schedule();
    if (!sched || sched.length === 0) return [];
    return sched.filter((d) => d.isClosed).map((d) => branchDayToJsDow(d.day));
  });

  protected readonly isExpressAvailable = computed(() => {
    const sched = this.schedule();
    if (!sched || sched.length === 0) return true; // sin info → permisivo
    const today = this.findScheduleByJsDow(sched, this.todayDow());
    if (!today || today.isClosed) return false;
    const closeMin = ServiceDatePickerComponent.timeStringToMinutes(today.closeTime);
    return closeMin - this.nowMinutesOfDay() >= EXPRESS_MIN_BUFFER_MINUTES;
  });

  protected readonly isTomorrowAvailable = computed(() => {
    const sched = this.schedule();
    if (!sched || sched.length === 0) return true;
    const tomorrow = this.findScheduleByJsDow(sched, this.tomorrowDow());
    return !!tomorrow && !tomorrow.isClosed;
  });

  protected readonly expressDisabledReason = computed<string | null>(() => {
    const sched = this.schedule();
    if (!sched || sched.length === 0) return null;
    const today = this.findScheduleByJsDow(sched, this.todayDow());
    if (!today || today.isClosed) return 'La sucursal no atiende hoy.';
    const closeMin = ServiceDatePickerComponent.timeStringToMinutes(today.closeTime);
    if (closeMin - this.nowMinutesOfDay() < EXPRESS_MIN_BUFFER_MINUTES) {
      return `Ya no es posible Express hoy. La sucursal cierra a las ${today.closeTime}.`;
    }
    return null;
  });

  protected readonly tomorrowDisabledReason = computed<string | null>(() => {
    const sched = this.schedule();
    if (!sched || sched.length === 0) return null;
    const tomorrow = this.findScheduleByJsDow(sched, this.tomorrowDow());
    if (!tomorrow || tomorrow.isClosed) return 'La sucursal no atiende mañana.';
    return null;
  });

  /** True cuando ni Express ni Mañana están disponibles — el usuario debe agendar. */
  protected readonly bothQuickOptionsBlocked = computed(
    () => !this.isExpressAvailable() && !this.isTomorrowAvailable(),
  );

  constructor() {
    effect(() => {
      const current = this.initial();
      if (!current) return;
      this.tier.set(current.tier);
      if (current.tier === 'scheduled') {
        this.scheduledDate.set(current.date);
      }
    }, { allowSignalWrites: true });

    // Reset reactivo: si cambia el schedule (ej. usuario cambia de sucursal)
    // y la fecha pedida ya no es válida, limpiar la selección.
    effect(() => {
      const sched = this.schedule();
      if (!sched || sched.length === 0) return;
      const current = this.tier();
      if (current === 'express' && !this.isExpressAvailable()) {
        this.tier.set(null);
        this.emit(null);
      } else if (current === 'tomorrow' && !this.isTomorrowAvailable()) {
        this.tier.set(null);
        this.emit(null);
      } else if (current === 'scheduled') {
        const iso = this.scheduledDate();
        if (iso && this.isClosedOnDate(iso)) {
          this.scheduledDate.set('');
          this.emit(null);
        }
      }
    }, { allowSignalWrites: true });
  }

  protected selectTier(next: ServiceDateTier): void {
    // Defense in depth — el botón ya está deshabilitado, pero por si llegan
    // por teclado/programáticamente.
    if (next === 'express' && !this.isExpressAvailable()) return;
    if (next === 'tomorrow' && !this.isTomorrowAvailable()) return;

    this.tier.set(next);
    if (next === 'express') {
      this.emit({ tier: 'express', date: this.todayIso });
    } else if (next === 'tomorrow') {
      this.emit({ tier: 'tomorrow', date: this.tomorrowIso });
    } else {
      const current = this.scheduledDate();
      if (current && current >= this.minScheduledIso && !this.isClosedOnDate(current)) {
        this.emit({ tier: 'scheduled', date: current });
      } else {
        this.emit(null);
      }
    }
  }

  protected onScheduledDateChange(iso: string | null | undefined): void {
    const value = iso || '';
    this.scheduledDate.set(value);
    if (this.tier() !== 'scheduled') return;
    if (value && value >= this.minScheduledIso && !this.isClosedOnDate(value)) {
      this.emit({ tier: 'scheduled', date: value });
    } else {
      this.emit(null);
    }
  }

  private emit(value: RequestedServiceDate | null): void {
    this.changed.emit(value);
  }

  /** True si la fecha ISO (YYYY-MM-DD) cae en un día donde la sucursal está cerrada. */
  private isClosedOnDate(iso: string): boolean {
    const closed = this.closedDaysOfWeek();
    if (closed.length === 0) return false;
    const dow = new Date(iso + 'T00:00:00').getDay();
    return closed.includes(dow);
  }

  private formatHumanDate(iso: string): string {
    return formatBusinessDate(iso, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  private static timeStringToMinutes(t: string): number {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
}
