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
import type { BranchAvailability, MechanicEffectiveWindow } from '@models/branch-availability.model';

/**
 * Travel + safety buffer (in minutes) added on top of the mechanic's service
 * duration to gate Express. The mechanic must finish the service + this
 * buffer before their effective close. Mirrors the same constant in the
 * backend `BranchAvailabilityService` — keep them in sync.
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
 *
 * Express / Tomorrow gating runs against `availability.todayWindows` and
 * `availability.tomorrowWindows` — sub-windows per mechanic with `dateBlocks`
 * already projected by the backend. Express requires that at least one
 * mechanic is currently *inside* their window AND has enough time to finish
 * the service + buffer before that window closes.
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
   * todos los mecánicos activos, con sus `dateBlocks` proyectados sobre hoy
   * y mañana. Cuando es null el picker actúa permisivamente (no puede
   * validar) y deja la decisión final al backend, cubriendo el caso
   * transitorio en que la disponibilidad aún no se cargó.
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
  // Availability-aware computeds — derived from the effective windows for
  // today/tomorrow. Sin availability devuelven defaults permisivos para
  // no bloquear cuando aún no se cargó la información.
  // ──────────────────────────────────────────────────────────────────────

  /** Hora actual expresada en minutos desde medianoche (0..1439). */
  private readonly nowMinutesOfDay = computed(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
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
    if (a.fullyBlockedDates.includes(this.todayIso)) return false;
    if (a.todayWindows.length === 0) return false;
    return this.anyWindowFitsNow(a.todayWindows, this.nowMinutesOfDay());
  });

  protected readonly isTomorrowAvailable = computed(() => {
    const a = this.availability();
    if (!a) return true;
    if (a.fullyBlockedDates.includes(this.tomorrowIso)) return false;
    return a.tomorrowWindows.length > 0;
  });

  protected readonly expressDisabledReason = computed<string | null>(() => {
    const a = this.availability();
    if (!a) return null;
    if (a.fullyBlockedDates.includes(this.todayIso)) {
      return 'Hoy todos los mecánicos están bloqueados en esta sucursal.';
    }
    if (a.todayWindows.length === 0) {
      return a.hasMechanics
        ? 'Ningún mecánico atiende hoy en esta sucursal.'
        : 'La sucursal no atiende hoy.';
    }
    const now = this.nowMinutesOfDay();
    if (this.anyWindowFitsNow(a.todayWindows, now)) return null;

    const anyOpenNow = a.todayWindows.some((w) => now >= w.openMin && now < w.closeMin);
    if (!anyOpenNow) {
      return 'Ningún mecánico está en turno en este momento.';
    }
    const latestClose = Math.max(...a.todayWindows.map((w) => w.closeMin));
    return `Ya no es posible Express hoy. El último mecánico cierra a las ${ServiceDatePickerComponent.minutesToTimeString(latestClose)}.`;
  });

  protected readonly tomorrowDisabledReason = computed<string | null>(() => {
    const a = this.availability();
    if (!a) return null;
    if (a.fullyBlockedDates.includes(this.tomorrowIso)) {
      return 'Mañana todos los mecánicos están bloqueados en esta sucursal.';
    }
    if (a.tomorrowWindows.length === 0) {
      return a.hasMechanics
        ? 'Ningún mecánico atiende mañana en esta sucursal.'
        : 'La sucursal no atiende mañana.';
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
   * True if the iso date (YYYY-MM-DD) falls on a day where no mechanic
   * attends — either by weekly schedule or by full-day block. Used by the
   * `scheduled` flow only; today/tomorrow have their own gating via the
   * effective windows.
   */
  private isClosedOnDate(iso: string): boolean {
    const a = this.availability();
    if (a?.fullyBlockedDates.includes(iso)) return true;
    const closed = this.closedDaysOfWeek();
    if (closed.length === 0) return false;
    const dow = new Date(iso + 'T00:00:00').getDay();
    return closed.includes(dow);
  }

  /**
   * True if at least one of the supplied windows can host a service starting
   * "now": the current minute must be inside `[openMin, closeMin - duration -
   * buffer]` for some window. This is the strict Express gate — it requires
   * a mechanic to be actively in turn AND with enough runway left.
   */
  private anyWindowFitsNow(windows: MechanicEffectiveWindow[], nowMin: number): boolean {
    return windows.some(
      (w) =>
        nowMin >= w.openMin &&
        nowMin + w.serviceDurationMinutes + EXPRESS_TRAVEL_BUFFER_MINUTES <= w.closeMin,
    );
  }

  private formatHumanDate(iso: string): string {
    return formatBusinessDate(iso, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  private static minutesToTimeString(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}
