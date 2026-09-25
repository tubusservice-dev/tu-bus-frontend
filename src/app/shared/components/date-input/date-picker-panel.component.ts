import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  parseIsoLocal,
  todayIso,
  MONTH_NAMES_ES,
  WEEKDAY_NAMES_SHORT_ES,
} from './utils/date-format.util';
import {
  DayCell,
  MonthCell,
  YearCell,
  ViewMode,
  YEAR_PAGE_SIZE,
  getYearRange,
  buildDayCells,
  buildMonthCells,
  buildYearCells,
  canNavigatePrev,
  canNavigateNext,
  shiftMonth,
  computeInitialAnchor,
} from './utils/date-picker-calendar.util';

/**
 * Calendar panel responsible for visual date selection.
 *
 * Rendered as a centered modal with backdrop on ALL viewports for consistent
 * UX (never overflows narrow parents like drawers or side modals).
 *
 * Navigation flow (Material Design pattern):
 *   days ──tap title──► years ──pick year──► months ──pick month──► days
 *
 * Purely presentational: emits ISO `YYYY-MM-DD` via `valueChange` and never
 * mutates inputs. Parent (`DateInputComponent`) owns the form-control value.
 * Calendar math lives in `utils/date-picker-calendar.util`.
 */
@Component({
  selector: 'app-date-picker-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './date-picker-panel.component.html',
  styleUrl: './date-picker-panel.component.scss',
})
export class DatePickerPanelComponent {
  /** Current committed value as ISO `YYYY-MM-DD` ('' when none). */
  readonly value = input<string>('');
  /** Optional lower bound (inclusive), ISO `YYYY-MM-DD`. */
  readonly min = input<string | null>(null);
  /** Optional upper bound (inclusive), ISO `YYYY-MM-DD`. */
  readonly max = input<string | null>(null);
  /**
   * Días de la semana (0=domingo … 6=sábado) que se renderizan deshabilitados
   * en el grid. Permite reflejar el horario de la sucursal: domingos cerrados,
   * etc. Vacío → no aplica filtro.
   */
  readonly disabledDaysOfWeek = input<number[]>([]);

  /** Emits confirmed ISO `YYYY-MM-DD` when user confirms, or '' on clear. */
  readonly valueChange = output<string>();
  /** Emits when user dismisses without confirming. */
  readonly dismissed = output<void>();

  protected readonly weekdayNames = WEEKDAY_NAMES_SHORT_ES;

  /** Current view — changes via header taps and sub-view selections. */
  protected readonly viewMode = signal<ViewMode>('days');

  /** Month currently displayed in the grid (0-11). */
  protected readonly viewMonth = signal<number>(new Date().getMonth());
  /** Year currently displayed. Also the center of the years-grid page. */
  protected readonly viewYear = signal<number>(new Date().getFullYear());
  /** Date the user has tentatively tapped — uncommitted until `Confirmar`. */
  protected readonly draftValue = signal<string>('');

  // ========== Label / aria computeds ==========

  protected readonly headerLabel = computed(() => {
    switch (this.viewMode()) {
      case 'years': {
        const range = this.yearRange();
        return `${range.start} – ${range.end}`;
      }
      case 'months':
        return String(this.viewYear());
      default:
        return `${MONTH_NAMES_ES[this.viewMonth()]} ${this.viewYear()}`;
    }
  });

  protected readonly titleAriaLabel = computed(() => {
    switch (this.viewMode()) {
      case 'years': return 'Volver a la vista de días';
      case 'months': return 'Seleccionar año';
      default: return 'Seleccionar mes y año';
    }
  });

  protected readonly prevAriaLabel = computed(() => {
    switch (this.viewMode()) {
      case 'years': return 'Años anteriores';
      case 'months': return 'Año anterior';
      default: return 'Mes anterior';
    }
  });

  protected readonly nextAriaLabel = computed(() => {
    switch (this.viewMode()) {
      case 'years': return 'Años siguientes';
      case 'months': return 'Año siguiente';
      default: return 'Mes siguiente';
    }
  });

  // ========== Derived data ==========

  /** Start/end years of the currently shown year-selector page. */
  private readonly yearRange = computed(() => getYearRange(this.viewYear()));

  protected readonly dayCells = computed<DayCell[]>(() =>
    buildDayCells(this.viewYear(), this.viewMonth(), {
      draft: this.draftValue(),
      today: todayIso(),
      minBound: this.min(),
      maxBound: this.max(),
      closedDows: this.disabledDaysOfWeek(),
    }),
  );

  protected readonly monthCells = computed<MonthCell[]>(() =>
    buildMonthCells(this.viewYear(), this.draftValue(), new Date(), this.min(), this.max()),
  );

  protected readonly yearCells = computed<YearCell[]>(() =>
    buildYearCells(
      this.yearRange(),
      this.draftValue(),
      this.viewYear(),
      new Date().getFullYear(),
      this.min(),
      this.max(),
    ),
  );

  /** Back-arrow enabled? Depends on the current view mode. */
  protected readonly canGoPrev = computed(() =>
    canNavigatePrev(
      this.viewMode(),
      { year: this.viewYear(), month: this.viewMonth() },
      this.yearRange(),
      this.min(),
    ),
  );

  /** Forward-arrow enabled? Depends on the current view mode. */
  protected readonly canGoNext = computed(() =>
    canNavigateNext(
      this.viewMode(),
      { year: this.viewYear(), month: this.viewMonth() },
      this.yearRange(),
      this.max(),
    ),
  );

  // ========== Lifecycle ==========

  constructor() {
    // Sync draft and view with incoming `value` on mount.
    queueMicrotask(() => {
      const initial = this.value();
      const date = initial ? parseIsoLocal(initial) : null;
      if (date) {
        this.draftValue.set(initial);
        this.viewMonth.set(date.getMonth());
        this.viewYear.set(date.getFullYear());
      } else {
        const anchor = computeInitialAnchor(new Date(), this.min(), this.max());
        this.viewMonth.set(anchor.getMonth());
        this.viewYear.set(anchor.getFullYear());
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Esc drills back up one level instead of closing outright
    switch (this.viewMode()) {
      case 'years':
        this.viewMode.set('days');
        return;
      case 'months':
        this.viewMode.set('years');
        return;
      default:
        this.onCancel();
    }
  }

  // ========== Navigation handlers ==========

  /** Tap on the header title drills into year selector (or back out). */
  protected onTitleClick(): void {
    switch (this.viewMode()) {
      case 'days':
      case 'months':
        this.viewMode.set('years');
        return;
      case 'years':
        // Tapping the title again cancels the drill-down
        this.viewMode.set('days');
    }
  }

  protected goPrev(): void {
    if (!this.canGoPrev()) return;
    this.navigate(-1);
  }

  protected goNext(): void {
    if (!this.canGoNext()) return;
    this.navigate(1);
  }

  // ========== Selection handlers ==========

  protected onSelectDay(cell: DayCell): void {
    if (cell.isDisabled) return;
    this.draftValue.set(cell.iso);
    // Pan the view if the tapped day falls outside the current month
    const d = parseIsoLocal(cell.iso);
    if (d && (d.getMonth() !== this.viewMonth() || d.getFullYear() !== this.viewYear())) {
      this.viewMonth.set(d.getMonth());
      this.viewYear.set(d.getFullYear());
    }
  }

  /** Pick a year → drill down to months. */
  protected onSelectYear(cell: YearCell): void {
    if (cell.isDisabled) return;
    this.viewYear.set(cell.year);
    this.viewMode.set('months');
  }

  /** Pick a month → drill down to days. */
  protected onSelectMonth(cell: MonthCell): void {
    if (cell.isDisabled) return;
    this.viewMonth.set(cell.monthIndex);
    this.viewMode.set('days');
  }

  // ========== Action bar handlers ==========

  protected onConfirm(): void {
    const draft = this.draftValue();
    if (!draft) return;
    this.valueChange.emit(draft);
  }

  protected onCancel(): void {
    this.dismissed.emit();
  }

  protected onBackdropClick(): void {
    this.onCancel();
  }

  /** Clears the draft AND the committed value immediately (no "Confirmar" needed). */
  protected onClear(): void {
    this.draftValue.set('');
    this.valueChange.emit('');
  }

  // ========== Private helpers ==========

  /** Moves one page back/forward: a year page, a year, or a month. */
  private navigate(direction: 1 | -1): void {
    switch (this.viewMode()) {
      case 'years':
        this.viewYear.update((y) => y + direction * YEAR_PAGE_SIZE);
        return;
      case 'months':
        this.viewYear.update((y) => y + direction);
        return;
      default: {
        const next = shiftMonth({ year: this.viewYear(), month: this.viewMonth() }, direction);
        this.viewMonth.set(next.month);
        this.viewYear.set(next.year);
      }
    }
  }
}
