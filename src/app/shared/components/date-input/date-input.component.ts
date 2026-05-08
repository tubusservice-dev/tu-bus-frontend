import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DatePickerPanelComponent } from './date-picker-panel.component';
import {
  applyMask,
  isoToDisplay,
  parseFlexibleDate,
  isWithinBounds,
} from './utils/date-format.util';
import { BodyScrollLockService } from '../../services/body-scroll-lock.service';

/**
 * Shared single-date input with a centered-modal calendar picker.
 *
 * Anatomy (Material 3 "Modal Date Input" pattern):
 *   [  DD/MM/YYYY            ] [📅]
 *                                ↓ on tap → centered modal with backdrop
 *
 * Why centered modal (instead of anchored popover / bottom sheet):
 *   - Never overflows narrow containers (drawers, side panels, modals).
 *   - Uniform UX across mobile and desktop.
 *   - Simpler layering — no viewport math required.
 *
 * Responsibilities (SRP):
 *   - Own the form-control value (via ControlValueAccessor).
 *   - Render the text input + calendar toggle button.
 *   - Mediate between typed input (with mask) and panel selections.
 *
 * Delegates the visual calendar to `DatePickerPanelComponent` so the two
 * concerns (input vs. visual selection) stay isolated and testable.
 *
 * Value contract:
 *   - Writes/emits ISO `YYYY-MM-DD` (backend-safe, always local calendar).
 *   - Displays `DD/MM/YYYY` (es-VE convention).
 *   - Accepts flexible user input per NN/g guidance (15-4-26, 15/4/2026, …).
 */
@Component({
  selector: 'app-date-input',
  standalone: true,
  imports: [CommonModule, DatePickerPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './date-input.component.html',
  styleUrl: './date-input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateInputComponent),
      multi: true,
    },
  ],
})
export class DateInputComponent implements ControlValueAccessor, OnDestroy {
  // ========== Inputs ==========

  readonly label = input<string>('');
  readonly placeholder = input<string>('DD/MM/YYYY');
  readonly id = input<string>('');
  /** Optional lower bound (inclusive), ISO `YYYY-MM-DD`. */
  readonly min = input<string | null>(null);
  /** Optional upper bound (inclusive), ISO `YYYY-MM-DD`. */
  readonly max = input<string | null>(null);
  /**
   * Días de la semana (0=domingo … 6=sábado) que se marcan como deshabilitados
   * en el calendar y se rechazan en la entrada manual. Pensado para que un
   * consumidor (ej. service-date-picker) refleje el horario de la sucursal.
   */
  readonly disabledDaysOfWeek = input<number[]>([]);
  readonly disabled = input<boolean>(false);
  readonly required = input<boolean>(false);
  /** Optional value (works alongside Reactive Forms / ngModel). */
  readonly value = input<string>('');

  // ========== Outputs ==========

  /** Emits ISO `YYYY-MM-DD` on valid change, '' when cleared. */
  readonly valueChange = output<string>();

  // ========== Internal state (signals) ==========

  /** Current committed ISO value. Source of truth for the form-control. */
  protected readonly isoValue = signal<string>('');
  /** Display text currently typed/shown in the input. */
  protected readonly displayText = signal<string>('');
  /** Whether the picker panel is currently open. */
  protected readonly isOpen = signal<boolean>(false);
  /** Parse error surfaced after blur when input cannot be resolved. */
  protected readonly hasParseError = signal<boolean>(false);
  /** Whether the control is currently disabled (from CVA or input). */
  protected readonly isDisabledInternal = signal<boolean>(false);

  protected readonly resolvedDisabled = computed(
    () => this.disabled() || this.isDisabledInternal(),
  );

  // ========== CVA callbacks ==========

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  private readonly scrollLock = inject(BodyScrollLockService);
  /**
   * Tracks whether this instance currently holds a body scroll lock so the
   * picker panel doesn't double-acquire and so the lock is released on
   * teardown when the panel was open.
   */
  private hasScrollLock = false;

  // ========== Lifecycle ==========

  ngOnDestroy(): void {
    // If the host (auth modal, profile form, etc.) is destroyed while the
    // picker panel is still open, release the lock so the page underneath
    // doesn't end up frozen.
    this.releaseScrollLock();
  }

  private acquireScrollLock(): void {
    if (this.hasScrollLock || typeof document === 'undefined') return;
    this.scrollLock.lock();
    this.hasScrollLock = true;
  }

  private releaseScrollLock(): void {
    if (!this.hasScrollLock || typeof document === 'undefined') return;
    this.scrollLock.unlock();
    this.hasScrollLock = false;
  }

  constructor() {
    // Sync with [value] input (for non-forms usage)
    queueMicrotask(() => {
      const v = this.value();
      if (v && !this.isoValue()) {
        this.writeValue(v);
      }
    });
  }

  // ========== ControlValueAccessor ==========

  writeValue(value: string | null | undefined): void {
    const iso = value ?? '';
    this.isoValue.set(iso);
    this.displayText.set(isoToDisplay(iso));
    this.hasParseError.set(false);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabledInternal.set(isDisabled);
  }

  // ========== User interactions (input field) ==========

  /**
   * Une `isWithinBounds` con la nueva regla `disabledDaysOfWeek` para evitar
   * duplicación entre `onInputChange`, `onInputBlur` y los handlers del panel.
   */
  private isAllowedIso(iso: string): boolean {
    if (!isWithinBounds(iso, this.min(), this.max())) return false;
    const closed = this.disabledDaysOfWeek();
    if (!closed || closed.length === 0) return true;
    const dow = new Date(iso + 'T00:00:00').getDay();
    return !closed.includes(dow);
  }

  protected onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    const masked = applyMask(raw);

    // Force-sync the DOM input to the masked value so non-digits the user
    // typed/pasted (e.g. "22/11/1983hgfghfghfghfgh") get stripped immediately
    // instead of waiting for the next change-detection tick. The signal
    // alone is not enough because Angular skips the [value] binding write
    // when the source comes from the same input event in the same tick.
    if (input.value !== masked) {
      input.value = masked;
    }
    this.displayText.set(masked);
    this.hasParseError.set(false);

    // Once the user has typed enough characters, try to parse and emit
    // optimistically so Reactive Forms validators see the new value in real
    // time. Invalid intermediate states don't clear the existing value.
    if (masked.length === 10) {
      const iso = parseFlexibleDate(masked);
      if (iso && this.isAllowedIso(iso)) {
        this.commitValue(iso);
      }
    }
  }

  protected onInputBlur(): void {
    this.onTouched();
    const text = this.displayText().trim();

    if (!text) {
      this.commitValue('');
      return;
    }

    const iso = parseFlexibleDate(text);
    if (iso && this.isAllowedIso(iso)) {
      this.commitValue(iso);
    } else {
      // Keep the invalid text visible so the user can correct it
      this.hasParseError.set(true);
    }
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
    } else if (event.key === 'Escape' && this.isOpen()) {
      this.closePanel();
    }
  }

  // ========== Panel toggle ==========

  protected togglePanel(): void {
    if (this.resolvedDisabled()) return;
    if (this.isOpen()) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  protected openPanel(): void {
    if (this.resolvedDisabled()) return;
    this.acquireScrollLock();
    this.isOpen.set(true);
  }

  protected closePanel(): void {
    this.releaseScrollLock();
    this.isOpen.set(false);
    this.onTouched();
  }

  // ========== Picker panel callbacks ==========

  protected onPanelValueChange(iso: string): void {
    this.commitValue(iso);
    this.closePanel();
  }

  protected onPanelDismissed(): void {
    this.closePanel();
  }

  // ========== Clear button ==========

  protected onClear(event: MouseEvent): void {
    event.stopPropagation();
    if (this.resolvedDisabled()) return;
    this.commitValue('');
  }

  // ========== Internal helpers ==========

  private commitValue(iso: string): void {
    this.isoValue.set(iso);
    this.displayText.set(isoToDisplay(iso));
    this.hasParseError.set(false);
    this.onChange(iso);
    this.valueChange.emit(iso);
  }
}
