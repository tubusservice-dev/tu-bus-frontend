import { Component, effect, input, output, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rating-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rating-modal.component.html',
  styleUrl: './rating-modal.component.scss',
})
export class RatingModalComponent implements OnDestroy {
  readonly isOpen = input<boolean>(false);
  readonly orderNumber = input<string | null>(null);
  readonly isSubmitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);

  readonly closed = output<void>();
  readonly submitted = output<{ rating: number; comment: string }>();

  protected readonly selectedRating = signal(0);
  protected readonly hoverRating = signal(0);
  protected readonly comment = signal('');

  protected readonly maxCommentLength = 500;
  protected readonly stars = [1, 2, 3, 4, 5];

  constructor() {
    effect(() => {
      document.body.style.overflow = this.isOpen() ? 'hidden' : '';
    });

    effect(() => {
      if (!this.isOpen()) {
        this.resetState();
      }
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  protected setRating(value: number): void {
    if (this.isSubmitting()) return;
    this.selectedRating.set(value);
  }

  protected setHover(value: number): void {
    if (this.isSubmitting()) return;
    this.hoverRating.set(value);
  }

  protected clearHover(): void {
    this.hoverRating.set(0);
  }

  protected onCommentChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.comment.set(value);
  }

  protected onCancel(): void {
    if (this.isSubmitting()) return;
    this.closed.emit();
  }

  protected onOverlayClick(): void {
    if (this.isSubmitting()) return;
    this.closed.emit();
  }

  protected onSubmit(): void {
    if (this.isSubmitting() || this.selectedRating() === 0) return;
    this.submitted.emit({
      rating: this.selectedRating(),
      comment: this.comment().trim(),
    });
  }

  private resetState(): void {
    this.selectedRating.set(0);
    this.hoverRating.set(0);
    this.comment.set('');
  }
}
