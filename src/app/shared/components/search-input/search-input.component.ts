import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Reusable search input with built-in debounce, loading spinner, and clear
 * button. Encapsulates the full search UX so callers do not duplicate the
 * Subject + debounceTime + distinctUntilChanged plumbing.
 *
 * Emits two events:
 *   - valueInput: fired immediately on every keystroke (use to light the
 *     spinner before the HTTP request starts)
 *   - searchChanged: fired after the debounce window expires (use to trigger
 *     the actual search/HTTP call)
 *
 * The `loading` input is caller-controlled: the parent turns it on when the
 * user starts typing and off when the data arrives.
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-input.component.html',
  styleUrl: './search-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchInputComponent implements OnInit {
  @Input() placeholder = 'Buscar...';
  @Input() value = '';
  @Input() loading = false;
  /** Debounce window in ms. Pass 0 to emit immediately (no debounce). */
  @Input() debounceMs = 400;
  @Input() showClearButton = true;
  @Input() ariaLabel = 'Buscar';
  /** Optional extra class applied to the outer wrapper (e.g., for widths) */
  @Input() wrapperClass = '';

  /** Fired after the debounce window — use this to trigger the HTTP request */
  @Output() searchChanged = new EventEmitter<string>();
  /** Fired immediately on every keystroke — use this to show pending state */
  @Output() valueInput = new EventEmitter<string>();

  protected readonly internalValue = signal('');
  private readonly searchSubject$ = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Sync initial value
    this.internalValue.set(this.value ?? '');

    const stream$ = this.debounceMs > 0
      ? this.searchSubject$.pipe(
          debounceTime(this.debounceMs),
          distinctUntilChanged(),
          takeUntilDestroyed(this.destroyRef),
        )
      : this.searchSubject$.pipe(
          distinctUntilChanged(),
          takeUntilDestroyed(this.destroyRef),
        );

    stream$.subscribe((v) => this.searchChanged.emit(v));
  }

  onInput(value: string): void {
    this.internalValue.set(value);
    this.valueInput.emit(value);
    this.searchSubject$.next(value);
  }

  clear(): void {
    if (!this.internalValue()) return;
    this.internalValue.set('');
    this.valueInput.emit('');
    // Force-flush: emit cleared value immediately bypassing debounce so the
    // caller can reset its result set without waiting.
    this.searchChanged.emit('');
  }
}
