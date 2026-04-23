import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MechanicAssignmentService } from '../../../../core/services/mechanic-assignment.service';
import {
  AvailableSlot,
  AvailableSlotsData,
} from '../../../../models/mechanic-assignment.model';

/**
 * Chip-grid with time slots pulled from the backend for a given
 * mechanic/date pair. Click on a slot emits the start time so the
 * parent modal can wire it to its existing form state.
 *
 * Reactive contract:
 *   - inputs change → re-fetches slots automatically.
 *   - loading and error states are signalled through local signals.
 *
 * Does NOT own the final hour selection — the parent can still accept a
 * manual time entry alongside these suggestions.
 */
@Component({
  selector: 'app-slots-suggestions',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slots-wrapper">
      <div class="slots-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="header-icon" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <span class="header-title">Sugerencias</span>
        <span class="header-subtitle">{{ data()?.serviceDurationMinutes ?? 0 }}min · disponibles</span>
        @if (selectedStartTime()) {
          <button type="button" class="clear-btn" (click)="clear()" title="Limpiar hora seleccionada">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Limpiar
          </button>
        }
      </div>

      @if (isLoading()) {
        <div class="status-block">
          <span class="spinner-sm"></span>
          <span>Calculando disponibilidad...</span>
        </div>
      } @else if (errorMessage()) {
        <div class="status-block status-error">
          {{ errorMessage() }}
        </div>
      } @else if (data()?.dayClosed) {
        <div class="status-block status-warning">
          El mecánico no trabaja este día.
        </div>
      } @else if (data()?.hasFullDayBlock) {
        <div class="status-block status-warning">
          El mecánico tiene bloqueado el día completo.
        </div>
      } @else if (data() && data()!.slots.length === 0) {
        <div class="status-block status-warning">
          No hay bloques disponibles con la duración del servicio.
        </div>
      } @else {
        <div class="slots-grid">
          @for (slot of data()?.slots; track slot.startTime) {
            <button
              type="button"
              class="slot-chip"
              [class.selected]="selectedStartTime() === slot.startTime"
              [class.slot-available]="slot.status === 'available'"
              [class.slot-booked]="slot.status === 'booked'"
              [class.slot-blocked]="slot.status === 'blocked'"
              [class.slot-past]="slot.status === 'past'"
              [disabled]="slot.status !== 'available'"
              (click)="pickSlot(slot)"
              [title]="slotTitle(slot)"
            >
              <span class="slot-time">{{ slot.startTime }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .slots-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.5rem 0.625rem;
      border: 1px dashed rgba(156, 163, 175, 0.5);
      border-radius: 0.5rem;
      background: rgba(249, 250, 251, 0.6);
    }
    :host-context(.dark) .slots-wrapper {
      background: rgba(31, 41, 55, 0.6);
      border-color: rgba(75, 85, 99, 0.6);
    }
    .slots-header {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .header-icon {
      width: 0.9rem; height: 0.9rem;
      color: var(--tubus-text-accent, #4d94ff);
      flex-shrink: 0;
    }
    .clear-btn {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.15rem 0.4rem;
      border: 1px solid transparent;
      border-radius: 0.35rem;
      background: transparent;
      color: #6b7280;
      font-size: 0.65rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .clear-btn svg {
      width: 0.75rem;
      height: 0.75rem;
    }
    .clear-btn:hover {
      color: #dc2626;
      background: rgba(239, 68, 68, 0.08);
    }
    :host-context(.dark) .clear-btn { color: #9ca3af; }
    :host-context(.dark) .clear-btn:hover {
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.15);
    }
    .header-title {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #111827;
      line-height: 1.2;
    }
    :host-context(.dark) .header-title { color: #f3f4f6; }
    .header-subtitle {
      display: block;
      font-size: 0.65rem;
      color: #9ca3af;
      line-height: 1.2;
    }
    :host-context(.dark) .header-subtitle { color: #6b7280; }
    .slots-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.3rem;
    }
    @media (min-width: 480px) {
      .slots-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    }
    .slot-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.3rem 0.25rem;
      border: 1px solid rgba(209, 213, 219, 0.7);
      border-radius: 0.4rem;
      background: #ffffff;
      cursor: pointer;
      transition: all 0.12s ease;
      position: relative;
    }
    :host-context(.dark) .slot-chip {
      background: #111827;
      border-color: #374151;
    }
    .slot-chip.slot-available:hover:not(:disabled) {
      border-color: #16a34a;
      background: rgba(22, 163, 74, 0.08);
    }
    .slot-chip.selected {
      border-color: #16a34a;
      background: rgba(22, 163, 74, 0.12);
      box-shadow: 0 0 0 1.5px rgba(22, 163, 74, 0.35);
    }
    .slot-chip:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .slot-chip.slot-booked {
      border-color: rgba(239, 68, 68, 0.35);
      background: rgba(239, 68, 68, 0.05);
    }
    .slot-chip.slot-blocked {
      border-color: rgba(234, 179, 8, 0.35);
      background: rgba(234, 179, 8, 0.05);
    }
    .slot-chip.slot-past     { border-color: rgba(107, 114, 128, 0.3); }
    .slot-time {
      font-size: 0.75rem;
      font-weight: 600;
      color: #111827;
      font-variant-numeric: tabular-nums;
      line-height: 1.3;
    }
    :host-context(.dark) .slot-time { color: #f3f4f6; }
    .status-block {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      background: #f3f4f6;
      font-size: 0.8rem;
      color: #4b5563;
    }
    :host-context(.dark) .status-block {
      background: rgba(17, 24, 39, 0.7);
      color: #9ca3af;
    }
    .status-warning { color: #b45309; background: #fef3c7; }
    .status-error   { color: #b91c1c; background: #fee2e2; }
    :host-context(.dark) .status-warning { background: rgba(180, 83, 9, 0.15); color: #fbbf24; }
    :host-context(.dark) .status-error   { background: rgba(153, 27, 27, 0.25); color: #fca5a5; }
    .spinner-sm {
      width: 0.9rem; height: 0.9rem;
      border-radius: 9999px;
      border: 2px solid #d1d5db;
      border-top-color: #4d94ff;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class SlotsSuggestionsComponent {
  private readonly mechanicAssignmentService = inject(MechanicAssignmentService);

  readonly mechanicId = input<string | null>(null);
  readonly date = input<string | null>(null);
  readonly orderId = input<string | null>(null);
  readonly step = input<number | null>(null);
  readonly selectedStartTime = input<string>('');
  readonly slotPicked = output<AvailableSlot>();
  readonly cleared = output<void>();

  protected readonly data = signal<AvailableSlotsData | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private lastRequestKey = '';

  protected readonly requestKey = computed(() => {
    const m = this.mechanicId();
    const d = this.date();
    if (!m || !d) return '';
    return `${m}|${d}|${this.step() ?? ''}|${this.orderId() ?? ''}`;
  });

  constructor() {
    effect(() => {
      const key = this.requestKey();
      if (!key) {
        this.data.set(null);
        this.errorMessage.set(null);
        return;
      }
      if (key === this.lastRequestKey) return;
      this.lastRequestKey = key;
      this.fetchSlots();
    });
  }

  protected pickSlot(slot: AvailableSlot): void {
    if (slot.status !== 'available') return;
    this.slotPicked.emit(slot);
  }

  protected clear(): void {
    this.cleared.emit();
  }

  protected slotBadge(slot: AvailableSlot): string {
    switch (slot.status) {
      case 'available': return 'Libre';
      case 'booked':    return 'Ocupado';
      case 'blocked':   return 'Bloqueado';
      case 'past':      return 'Pasado';
    }
  }

  protected slotTitle(slot: AvailableSlot): string {
    return `${slot.startTime} - ${slot.endTime} (${this.slotBadge(slot)})`;
  }

  private fetchSlots(): void {
    const m = this.mechanicId();
    const d = this.date();
    if (!m || !d) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.mechanicAssignmentService
      .getAvailableSlots(m, d, this.orderId() || undefined, this.step() ?? undefined)
      .subscribe({
        next: (res) => {
          this.data.set(res.data);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'No se pudieron cargar los horarios');
          this.isLoading.set(false);
        },
      });
  }
}
