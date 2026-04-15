import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SearchableOption {
  id: string;
  label: string;
}

export type ChipVariant = 'blue' | 'green' | 'purple';

/**
 * Reusable single-select combobox with inline search and chip display.
 *
 * Renders:
 *   - A chip showing the selected option (with ✕ to clear) when something is
 *     selected, OR
 *   - A search input + dropdown of filtered options when nothing is selected.
 *
 * Consolidates the pattern that previously lived inline in product-form for
 * brand selection, so any single-select "searchable dropdown with chip" use
 * case can reuse it without duplicating state/markup/styles.
 */
@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchableSelectComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input() options: SearchableOption[] = [];
  @Input() set selected(value: SearchableOption | null) {
    this._selected.set(value);
  }
  get selected(): SearchableOption | null {
    return this._selected();
  }
  @Input() placeholder = 'Buscar...';
  @Input() emptyMessage = 'No se encontraron resultados';
  @Input() chipVariant: ChipVariant = 'blue';
  @Input() ariaLabel = '';
  @Input() invalid = false;

  @Output() selectedChange = new EventEmitter<SearchableOption | null>();

  protected readonly _selected = signal<SearchableOption | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly showDropdown = signal(false);

  protected readonly filtered = computed<SearchableOption[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const sel = this._selected();

    let result = this.options;
    if (sel) {
      result = result.filter((o) => o.id !== sel.id);
    }
    if (term) {
      result = result.filter((o) => o.label.toLowerCase().includes(term));
    }
    return result;
  });

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.showDropdown.set(true);
  }

  openDropdown(): void {
    this.showDropdown.set(true);
  }

  select(option: SearchableOption): void {
    this._selected.set(option);
    this.searchTerm.set('');
    this.showDropdown.set(false);
    this.selectedChange.emit(option);
  }

  clear(): void {
    this._selected.set(null);
    this.selectedChange.emit(null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Node;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.showDropdown.set(false);
    }
  }
}
