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
  formatIsoLocal,
  parseIsoLocal,
  todayIso,
  compareIso,
  isWithinBounds,
  MONTH_NAMES_ES,
  MONTH_NAMES_ES_SHORT,
  WEEKDAY_NAMES_SHORT_ES,
} from './utils/date-format.util';

/** Single cell rendered in the month (day) grid. */
interface DayCell {
  iso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
}

/** Single cell rendered in the month-selector grid. */
interface MonthCell {
  monthIndex: number;     // 0-11
  monthName: string;      // "Ene", "Feb", ...
  isSelected: boolean;
  isCurrent: boolean;
  isDisabled: boolean;
}

/** Single cell rendered in the year-selector grid. */
interface YearCell {
  year: number;
  isSelected: boolean;
  isCurrent: boolean;
  isDisabled: boolean;
}

/** Size of the year grid — 16 cells (4 columns × 4 rows). */
const YEAR_PAGE_SIZE = 16;

/**
 * Three navigation views in ascending specificity:
 *   - `years`  → pick a year (drill-down entry point).
 *   - `months` → pick a month within the chosen year.
 *   - `days`   → pick a day within the chosen year+month.
 */
type ViewMode = 'days' | 'months' | 'years';

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
 */
@Component({
  selector: 'app-date-picker-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop (always rendered — modal pattern) -->
    <div class="picker-backdrop" (click)="onBackdropClick()"></div>

    <div
      class="picker-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Selector de fecha"
      (click)="$event.stopPropagation()"
    >
      <!-- Close button -->
      <button
        type="button"
        class="picker-close"
        aria-label="Cerrar selector"
        (click)="onCancel()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Header: nav + clickable title -->
      <header class="picker-header">
        <button
          type="button"
          class="picker-nav-btn"
          [attr.aria-label]="prevAriaLabel()"
          [disabled]="!canGoPrev()"
          (click)="goPrev()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <button
          type="button"
          class="picker-title-btn"
          [attr.aria-label]="titleAriaLabel()"
          (click)="onTitleClick()"
        >
          <span class="picker-title">{{ headerLabel() }}</span>
          <svg
            class="picker-title-chevron"
            [class.rotated]="viewMode() !== 'days'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <button
          type="button"
          class="picker-nav-btn"
          [attr.aria-label]="nextAriaLabel()"
          [disabled]="!canGoNext()"
          (click)="goNext()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </header>

      <!-- View: days grid -->
      @if (viewMode() === 'days') {
        <div class="picker-weekdays">
          @for (wd of weekdayNames; track wd) {
            <span class="picker-weekday">{{ wd }}</span>
          }
        </div>
        <div class="picker-grid" role="grid">
          @for (cell of dayCells(); track cell.iso) {
            <button
              type="button"
              class="picker-cell"
              [class.other-month]="!cell.isCurrentMonth"
              [class.today]="cell.isToday"
              [class.selected]="cell.isSelected"
              [disabled]="cell.isDisabled"
              [attr.aria-label]="cell.iso"
              [attr.aria-pressed]="cell.isSelected"
              (click)="onSelectDay(cell)"
            >
              {{ cell.dayNumber }}
            </button>
          }
        </div>
      }

      <!-- View: months grid -->
      @if (viewMode() === 'months') {
        <div class="picker-months-grid" role="grid">
          @for (cell of monthCells(); track cell.monthIndex) {
            <button
              type="button"
              class="picker-month-cell"
              [class.selected]="cell.isSelected"
              [class.current]="cell.isCurrent"
              [disabled]="cell.isDisabled"
              [attr.aria-label]="cell.monthName"
              [attr.aria-pressed]="cell.isSelected"
              (click)="onSelectMonth(cell)"
            >
              {{ cell.monthName }}
            </button>
          }
        </div>
      }

      <!-- View: years grid -->
      @if (viewMode() === 'years') {
        <div class="picker-years-grid" role="grid">
          @for (cell of yearCells(); track cell.year) {
            <button
              type="button"
              class="picker-year-cell"
              [class.selected]="cell.isSelected"
              [class.current]="cell.isCurrent"
              [disabled]="cell.isDisabled"
              [attr.aria-label]="cell.year"
              [attr.aria-pressed]="cell.isSelected"
              (click)="onSelectYear(cell)"
            >
              {{ cell.year }}
            </button>
          }
        </div>
      }

      <!-- Action bar -->
      <footer class="picker-footer">
        <div class="picker-action-left">
          <button type="button" class="picker-action picker-action-ghost" (click)="goToday()">
            Hoy
          </button>
          @if (draftValue()) {
            <button
              type="button"
              class="picker-action picker-action-danger"
              (click)="onClear()"
            >
              Borrar
            </button>
          }
        </div>
        <div class="picker-action-right">
          <button type="button" class="picker-action picker-action-cancel" (click)="onCancel()">
            Cancelar
          </button>
          <button
            type="button"
            class="picker-action picker-action-confirm"
            [disabled]="!draftValue()"
            (click)="onConfirm()"
          >
            Confirmar
          </button>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
    }

    /* ========== Backdrop ========== */
    .picker-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 70;
      animation: pickerFadeIn 200ms ease-out;
    }

    @keyframes pickerFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes pickerModalIn {
      from {
        opacity: 0;
        transform: translate(-50%, -48%) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    /* ========== Centered modal panel ========== */
    .picker-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 80;
      width: calc(100vw - 32px);
      max-width: 360px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      padding: 20px 16px 16px;
      background: var(--bg-primary, #ffffff);
      color: var(--text-primary, #171717);
      border: 1px solid var(--border-color, #e5e5e5);
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2),
                  0 10px 10px -5px rgba(0, 0, 0, 0.1);
      animation: pickerModalIn 220ms cubic-bezier(0.32, 0.72, 0, 1);
    }

    :host-context(.dark) .picker-panel {
      background: var(--bg-secondary, #171717);
      border-color: #262626;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5),
                  0 10px 10px -5px rgba(0, 0, 0, 0.4);
    }

    /* ========== Close button ========== */
    .picker-close {
      position: absolute;
      top: 10px;
      right: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      border: 0;
      border-radius: 8px;
      color: var(--text-secondary, #525252);
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease;

      svg { width: 16px; height: 16px; }

      &:hover {
        background: var(--bg-secondary, #f5f5f5);
        color: var(--text-primary, #171717);
      }
    }

    :host-context(.dark) .picker-close {
      color: #a3a3a3;

      &:hover {
        background: var(--bg-tertiary, #262626);
        color: #fafafa;
      }
    }

    /* ========== Header ========== */
    .picker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
      padding-right: 36px; /* reserve space for close button */
    }

    .picker-title-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      background: transparent;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
      transition: background 150ms ease;

      &:hover {
        background: var(--bg-secondary, #f5f5f5);
      }
    }

    :host-context(.dark) .picker-title-btn:hover {
      background: var(--bg-tertiary, #262626);
    }

    .picker-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary, #171717);
      text-transform: capitalize;
    }

    :host-context(.dark) .picker-title { color: #fafafa; }

    .picker-title-chevron {
      width: 14px;
      height: 14px;
      color: var(--text-tertiary, #a3a3a3);
      transition: transform 200ms ease;

      &.rotated {
        transform: rotate(180deg);
      }
    }

    .picker-nav-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      border: 0;
      border-radius: 8px;
      color: var(--text-secondary, #525252);
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease;

      svg { width: 18px; height: 18px; }

      &:hover:not(:disabled) {
        background: var(--bg-secondary, #f5f5f5);
        color: var(--text-primary, #171717);
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }

    :host-context(.dark) .picker-nav-btn {
      color: #a3a3a3;

      &:hover:not(:disabled) {
        background: var(--bg-tertiary, #262626);
        color: #fafafa;
      }
    }

    /* ========== Weekday headers ========== */
    .picker-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
      margin-bottom: 4px;
    }

    .picker-weekday {
      text-align: center;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-tertiary, #737373);
      text-transform: uppercase;
      padding: 6px 0;
    }

    /* ========== Day grid ========== */
    .picker-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }

    .picker-cell {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1 / 1;
      min-height: 40px;
      padding: 0;
      background: transparent;
      border: 0;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #171717);
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;

      &:hover:not(:disabled) {
        background: var(--accent-light, rgba(0, 29, 86, 0.1));
      }

      &.other-month { color: var(--text-tertiary, #a3a3a3); opacity: 0.45; }

      &.today {
        font-weight: 700;
        box-shadow: inset 0 0 0 1px var(--accent-primary, #001d56);
      }

      &.selected {
        background: var(--accent-primary, #001d56);
        color: #ffffff;
        font-weight: 600;

        &:hover:not(:disabled) {
          background: var(--accent-hover, #001438);
        }
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        text-decoration: line-through;
      }
    }

    :host-context(.dark) .picker-cell {
      color: #fafafa;

      &.other-month { color: #737373; }

      /* Hover adds light (not color) on dark backgrounds — preserves text contrast */
      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
      }

      /* Today indicator with a lighter blue border — distinguishes from hover tint */
      &.today {
        box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.6);
      }
    }

    /* ========== Month grid ========== */
    .picker-months-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 8px 0 4px;
    }

    .picker-month-cell {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 52px;
      padding: 0 8px;
      background: transparent;
      border: 0;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #171717);
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
      text-transform: capitalize;

      &:hover:not(:disabled) {
        background: var(--accent-light, rgba(0, 29, 86, 0.1));
      }

      &.current {
        font-weight: 700;
        box-shadow: inset 0 0 0 1px var(--accent-primary, #001d56);
      }

      &.selected {
        background: var(--accent-primary, #001d56);
        color: #ffffff;
        font-weight: 600;

        &:hover:not(:disabled) {
          background: var(--accent-hover, #001438);
        }
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        text-decoration: line-through;
      }
    }

    :host-context(.dark) .picker-month-cell {
      color: #fafafa;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
      }

      &.current {
        box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.6);
      }
    }

    /* ========== Year grid ========== */
    .picker-years-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 8px 0 4px;
    }

    .picker-year-cell {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      padding: 0 8px;
      background: transparent;
      border: 0;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #171717);
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;

      &:hover:not(:disabled) {
        background: var(--accent-light, rgba(0, 29, 86, 0.1));
      }

      &.current {
        font-weight: 700;
        box-shadow: inset 0 0 0 1px var(--accent-primary, #001d56);
      }

      &.selected {
        background: var(--accent-primary, #001d56);
        color: #ffffff;
        font-weight: 600;

        &:hover:not(:disabled) {
          background: var(--accent-hover, #001438);
        }
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        text-decoration: line-through;
      }
    }

    :host-context(.dark) .picker-year-cell {
      color: #fafafa;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
      }

      &.current {
        box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.6);
      }
    }

    /* ========== Footer ========== */
    .picker-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border-color, #e5e5e5);
      flex-wrap: wrap;
    }

    :host-context(.dark) .picker-footer { border-top-color: #262626; }

    .picker-action-left,
    .picker-action-right {
      display: flex;
      gap: 6px;
    }

    .picker-action {
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 500;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
      transition: background 150ms ease;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .picker-action-ghost {
      background: transparent;
      color: var(--accent-primary, #001d56);

      &:hover:not(:disabled) { background: var(--accent-light, rgba(0, 29, 86, 0.1)); }
    }

    :host-context(.dark) .picker-action-ghost {
      color: #93c5fd;

      &:hover:not(:disabled) { background: rgba(147, 197, 253, 0.12); }
    }

    .picker-action-danger {
      background: transparent;
      color: #ef4444;

      &:hover:not(:disabled) { background: rgba(239, 68, 68, 0.1); }
    }

    :host-context(.dark) .picker-action-danger {
      color: #fca5a5;

      &:hover:not(:disabled) { background: rgba(252, 165, 165, 0.12); }
    }

    .picker-action-cancel {
      background: var(--bg-secondary, #f5f5f5);
      color: var(--text-secondary, #525252);

      &:hover:not(:disabled) { background: var(--bg-tertiary, #e5e5e5); }
    }

    :host-context(.dark) .picker-action-cancel {
      background: var(--bg-tertiary, #262626);
      color: #a3a3a3;

      &:hover:not(:disabled) { background: #404040; }
    }

    .picker-action-confirm {
      background: var(--accent-primary, #001d56);
      color: #ffffff;

      &:hover:not(:disabled) { background: var(--accent-hover, #001438); }
    }

    /* ========== Tighter spacing on very small viewports ========== */
    @media (max-width: 360px) {
      .picker-panel { padding: 16px 12px 12px; }
      .picker-cell { min-height: 36px; font-size: 13px; }
      .picker-month-cell { height: 46px; font-size: 13px; }
      .picker-year-cell { height: 40px; font-size: 13px; }
      .picker-action { padding: 7px 10px; font-size: 12px; }
    }
  `],
})
export class DatePickerPanelComponent {
  /** Current committed value as ISO `YYYY-MM-DD` ('' when none). */
  readonly value = input<string>('');
  /** Optional lower bound (inclusive), ISO `YYYY-MM-DD`. */
  readonly min = input<string | null>(null);
  /** Optional upper bound (inclusive), ISO `YYYY-MM-DD`. */
  readonly max = input<string | null>(null);

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
  private readonly yearRange = computed(() => {
    const center = this.viewYear();
    const start = center - Math.floor(YEAR_PAGE_SIZE / 2) + 1;
    return { start, end: start + YEAR_PAGE_SIZE - 1 };
  });

  /** 42-cell month grid (6 weeks × 7 days) starting on Monday. */
  protected readonly dayCells = computed<DayCell[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const draft = this.draftValue();
    const today = todayIso();
    const minBound = this.min();
    const maxBound = this.max();

    const firstOfMonth = new Date(year, month, 1);
    const firstDay = (firstOfMonth.getDay() + 6) % 7; // Monday=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const out: DayCell[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      out.push(this.buildDayCell(d, false, draft, today, minBound, maxBound));
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      out.push(this.buildDayCell(d, true, draft, today, minBound, maxBound));
    }
    const remaining = 42 - out.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      out.push(this.buildDayCell(d, false, draft, today, minBound, maxBound));
    }

    return out;
  });

  /** 12 month cells for the currently selected viewYear. */
  protected readonly monthCells = computed<MonthCell[]>(() => {
    const year = this.viewYear();
    const draft = this.draftValue();
    const draftDate = draft ? parseIsoLocal(draft) : null;
    const draftYear = draftDate ? draftDate.getFullYear() : null;
    const draftMonth = draftDate ? draftDate.getMonth() : null;
    const today = new Date();
    const minBound = this.min();
    const maxBound = this.max();

    const out: MonthCell[] = [];
    for (let m = 0; m < 12; m++) {
      // A month is disabled when the entire month falls outside [min, max]
      const firstIso = formatIsoLocal(new Date(year, m, 1));
      const lastIso = formatIsoLocal(new Date(year, m + 1, 0));
      const isDisabled =
        (minBound !== null && compareIso(lastIso, minBound) < 0) ||
        (maxBound !== null && compareIso(firstIso, maxBound) > 0);

      out.push({
        monthIndex: m,
        monthName: MONTH_NAMES_ES_SHORT[m],
        isSelected: draftYear === year && draftMonth === m,
        isCurrent: today.getFullYear() === year && today.getMonth() === m,
        isDisabled,
      });
    }
    return out;
  });

  /** 16 year cells surrounding the current viewYear. */
  protected readonly yearCells = computed<YearCell[]>(() => {
    const range = this.yearRange();
    const draft = this.draftValue();
    const draftYear = draft ? Number(draft.slice(0, 4)) : null;
    const currentYear = new Date().getFullYear();
    const minBound = this.min();
    const maxBound = this.max();
    const minYear = minBound ? Number(minBound.slice(0, 4)) : null;
    const maxYear = maxBound ? Number(maxBound.slice(0, 4)) : null;

    const out: YearCell[] = [];
    for (let y = range.start; y <= range.end; y++) {
      const isDisabled =
        (minYear !== null && y < minYear) || (maxYear !== null && y > maxYear);
      out.push({
        year: y,
        isSelected: y === draftYear || (draftYear === null && y === this.viewYear()),
        isCurrent: y === currentYear,
        isDisabled,
      });
    }
    return out;
  });

  /** Back-arrow enabled? Depends on the current view mode. */
  protected readonly canGoPrev = computed(() => {
    const minBound = this.min();
    if (!minBound) return true;
    const minYear = Number(minBound.slice(0, 4));

    switch (this.viewMode()) {
      case 'years':
        return this.yearRange().start > minYear;
      case 'months':
        return this.viewYear() > minYear;
      default: {
        const firstOfCurrent = formatIsoLocal(
          new Date(this.viewYear(), this.viewMonth(), 1),
        );
        return compareIso(firstOfCurrent, minBound) > 0;
      }
    }
  });

  /** Forward-arrow enabled? Depends on the current view mode. */
  protected readonly canGoNext = computed(() => {
    const maxBound = this.max();
    if (!maxBound) return true;
    const maxYear = Number(maxBound.slice(0, 4));

    switch (this.viewMode()) {
      case 'years':
        return this.yearRange().end < maxYear;
      case 'months':
        return this.viewYear() < maxYear;
      default: {
        const lastOfCurrent = formatIsoLocal(
          new Date(this.viewYear(), this.viewMonth() + 1, 0),
        );
        return compareIso(lastOfCurrent, maxBound) < 0;
      }
    }
  });

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
        const today = new Date();
        this.viewMonth.set(today.getMonth());
        this.viewYear.set(today.getFullYear());
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
    switch (this.viewMode()) {
      case 'years':
        this.viewYear.update((y) => y - YEAR_PAGE_SIZE);
        return;
      case 'months':
        this.viewYear.update((y) => y - 1);
        return;
      default:
        if (this.viewMonth() === 0) {
          this.viewMonth.set(11);
          this.viewYear.update((y) => y - 1);
        } else {
          this.viewMonth.update((m) => m - 1);
        }
    }
  }

  protected goNext(): void {
    if (!this.canGoNext()) return;
    switch (this.viewMode()) {
      case 'years':
        this.viewYear.update((y) => y + YEAR_PAGE_SIZE);
        return;
      case 'months':
        this.viewYear.update((y) => y + 1);
        return;
      default:
        if (this.viewMonth() === 11) {
          this.viewMonth.set(0);
          this.viewYear.update((y) => y + 1);
        } else {
          this.viewMonth.update((m) => m + 1);
        }
    }
  }

  protected goToday(): void {
    const today = new Date();
    const iso = formatIsoLocal(today);
    if (!isWithinBounds(iso, this.min(), this.max())) return;
    this.viewMonth.set(today.getMonth());
    this.viewYear.set(today.getFullYear());
    this.draftValue.set(iso);
    this.viewMode.set('days');
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

  private buildDayCell(
    date: Date,
    isCurrentMonth: boolean,
    draft: string,
    today: string,
    minBound: string | null,
    maxBound: string | null,
  ): DayCell {
    const iso = formatIsoLocal(date);
    return {
      iso,
      dayNumber: date.getDate(),
      isCurrentMonth,
      isToday: iso === today,
      isSelected: iso === draft,
      isDisabled: !isWithinBounds(iso, minBound, maxBound),
    };
  }
}
