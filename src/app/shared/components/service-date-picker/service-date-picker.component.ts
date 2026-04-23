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
import { DateInputComponent } from '../date-input/date-input.component';
import type { RequestedServiceDate, ServiceDateTier } from '../../../features/checkout/services/checkout.service';

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
  readonly changed = output<RequestedServiceDate | null>();

  protected readonly tier = signal<ServiceDateTier | null>(null);
  protected readonly scheduledDate = signal<string>('');

  protected readonly todayIso = this.buildIsoOffset(0);
  protected readonly tomorrowIso = this.buildIsoOffset(1);
  protected readonly minScheduledIso = this.buildIsoOffset(2);

  protected readonly todayLabel = this.formatHumanDate(this.todayIso);
  protected readonly tomorrowLabel = this.formatHumanDate(this.tomorrowIso);

  protected readonly scheduledLabel = computed(() => {
    const iso = this.scheduledDate();
    return iso ? this.formatHumanDate(iso) : '';
  });

  constructor() {
    effect(() => {
      const current = this.initial();
      if (!current) return;
      this.tier.set(current.tier);
      if (current.tier === 'scheduled') {
        this.scheduledDate.set(current.date);
      }
    }, { allowSignalWrites: true });
  }

  protected selectTier(next: ServiceDateTier): void {
    this.tier.set(next);
    if (next === 'express') {
      this.emit({ tier: 'express', date: this.todayIso });
    } else if (next === 'tomorrow') {
      this.emit({ tier: 'tomorrow', date: this.tomorrowIso });
    } else {
      const current = this.scheduledDate();
      if (current && current >= this.minScheduledIso) {
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
    if (value && value >= this.minScheduledIso) {
      this.emit({ tier: 'scheduled', date: value });
    } else {
      this.emit(null);
    }
  }

  private emit(value: RequestedServiceDate | null): void {
    this.changed.emit(value);
  }

  private buildIsoOffset(days: number): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatHumanDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return '';
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-VE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
}
