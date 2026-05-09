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
import type { BranchAvailability } from '@models/branch-availability.model';

/**
 * Travel buffer (in minutes) added on top of the mechanic's service duration
 * to gate Express. Combined with `availability.minServiceDurationMinutes`,
 * Express stays open while there is still time to travel + complete the
 * service before the latest close.
 */
const EXPRESS_TRAVEL_BUFFER_MINUTES = 30;

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
   * Disponibilidad agregada de la sucursal — la unión de los horarios de
   * todos los mecánicos activos. Cuando es null el picker actúa
   * permisivamente (no puede validar) y deja la decisión final al backend,
   * cubriendo el caso transitorio en que la disponibilidad aún no se cargó.
   *
   * `schedule[d]` está indexado por convención JS (0 = domingo … 6 = sábado),
   * por lo que se compara directamente contra `new Date(iso).getDay()` sin
   * conversiones intermedias.
   */
  readonly availability = input<BranchAvailability | null>(null);
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
  // Availability-aware computeds — derived from the aggregated mechanic
  // availability input. Sin availability devuelven defaults permisivos
  // para no bloquear cuando aún no se cargó la información.
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
   * Buffer mínimo necesario entre la hora actual y el cierre del último
   * mecánico para permitir Express: duración mínima del servicio entre los
   * mecánicos + buffer de traslado. Si no hay disponibilidad cargada, cae
   * a 120 min como heurística histórica.
   */
  private readonly expressMinBufferMinutes = computed(() => {
    const a = this.availability();
    if (!a) return 120;
    return a.minServiceDurationMinutes + EXPRESS_TRAVEL_BUFFER_MINUTES;
  });

  /**
   * Días de la semana donde NINGÚN mecánico atiende, en convención
   * `Date.getDay()`. El availability ya viene en esa convención.
   */
  protected readonly closedDaysOfWeek = computed<number[]>(() => {
    const a = this.availability();
    if (!a) return [];
    return a.schedule.filter((d) => d.isClosed).map((d) => d.day);
  });

  protected readonly isExpressAvailable = computed(() => {
    const a = this.availability();
    if (!a) return true; // sin info → permisivo
    const today = a.schedule[this.todayDow()];
    if (!today || today.isClosed) return false;
    if (a.fullyBlockedDates.includes(this.todayIso)) return false;
    const closeMin = ServiceDatePickerComponent.timeStringToMinutes(today.latestClose);
    return closeMin - this.nowMinutesOfDay() >= this.expressMinBufferMinutes();
  });

  protected readonly isTomorrowAvailable = computed(() => {
    const a = this.availability();
    if (!a) return true;
    const tomorrow = a.schedule[this.tomorrowDow()];
    if (!tomorrow || tomorrow.isClosed) return false;
    return !a.fullyBlockedDates.includes(this.tomorrowIso);
  });

  protected readonly expressDisabledReason = computed<string | null>(() => {
    const a = this.availability();
    if (!a) return null;
    const today = a.schedule[this.todayDow()];
    if (!today || today.isClosed) {
      return a.hasMechanics
        ? 'Ningún mecánico atiende hoy en esta sucursal.'
        : 'La sucursal no atiende hoy.';
    }
    if (a.fullyBlockedDates.includes(this.todayIso)) {
      return 'Hoy todos los mecánicos están bloqueados en esta sucursal.';
    }
    const closeMin = ServiceDatePickerComponent.timeStringToMinutes(today.latestClose);
    if (closeMin - this.nowMinutesOfDay() < this.expressMinBufferMinutes()) {
      return `Ya no es posible Express hoy. El último mecánico cierra a las ${today.latestClose}.`;
    }
    return null;
  });

  protected readonly tomorrowDisabledReason = computed<string | null>(() => {
    const a = this.availability();
    if (!a) return null;
    const tomorrow = a.schedule[this.tomorrowDow()];
    if (!tomorrow || tomorrow.isClosed) {
      return a.hasMechanics
        ? 'Ningún mecánico atiende mañana en esta sucursal.'
        : 'La sucursal no atiende mañana.';
    }
    if (a.fullyBlockedDates.includes(this.tomorrowIso)) {
      return 'Mañana todos los mecánicos están bloqueados en esta sucursal.';
    }
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

    // Reset reactivo: si cambia la disponibilidad (ej. usuario cambia de
    // sucursal) y la fecha pedida ya no es válida, limpiar la selección.
    effect(() => {
      const a = this.availability();
      if (!a) return;
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

  /**
   * True si la fecha ISO (YYYY-MM-DD) cae en un día donde ningún mecánico
   * de la sucursal atiende — sea por horario semanal o por bloqueo total
   * (todos los mecánicos con un dateBlock cubriendo esa fecha).
   */
  private isClosedOnDate(iso: string): boolean {
    const a = this.availability();
    if (a?.fullyBlockedDates.includes(iso)) return true;
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
