import { Component, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MechanicService } from '../../../../core/services/mechanic.service';
import { Mechanic } from '../../../../models/mechanic.model';

@Component({
  selector: 'app-date-block-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './date-block-modal.component.html',
  styleUrl: './date-block-modal.component.scss',
})
export class DateBlockModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly mechanicService = inject(MechanicService);

  readonly mechanicId = input.required<string>();
  readonly isOpen = input.required<boolean>();
  readonly closed = output<void>();
  readonly saved = output<Mechanic>();

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form: FormGroup = this.fb.group({
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    isAllDay: [true],
    startTime: ['08:00'],
    endTime: ['18:00'],
    reason: [''],
  });

  close(): void {
    this.form.reset({ isAllDay: true, startTime: '08:00', endTime: '18:00' });
    this.errorMessage.set(null);
    this.closed.emit();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const val = this.form.value;
    const data = {
      startDate: val.startDate,
      endDate: val.endDate,
      isAllDay: val.isAllDay,
      startTime: val.isAllDay ? undefined : val.startTime,
      endTime: val.isAllDay ? undefined : val.endTime,
      reason: val.reason || undefined,
    };

    this.mechanicService.addDateBlock(this.mechanicId(), data).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.saved.emit(res.data);
        this.close();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Error al agregar bloqueo');
        this.isSubmitting.set(false);
      },
    });
  }
}
