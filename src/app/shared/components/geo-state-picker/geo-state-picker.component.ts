import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, model, signal } from '@angular/core';
import { GeoState } from '@models/geo.model';

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * State picker with search. States with service come first, so the usual
 * choice is always one click away instead of at the end of 24 names.
 */
@Component({
  selector: 'app-geo-state-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './geo-state-picker.component.html',
  styleUrl: './geo-state-picker.component.scss',
})
export class GeoStatePickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly states = input.required<GeoState[]>();
  /** Ids of the states with coverage, listed first. */
  readonly coveredIds = input<ReadonlySet<string>>(new Set());
  /** Municipalities per state, shown next to covered states. */
  readonly municipalityCounts = input<ReadonlyMap<string, number>>(new Map());
  readonly selected = model<string | null>(null);
  readonly placeholder = input('Selecciona un estado');

  protected readonly open = signal(false);
  protected readonly term = signal('');

  protected readonly selectedName = computed(() => this.states().find((s) => s.id === this.selected())?.name ?? null);

  protected readonly groups = computed(() => {
    const term = normalize(this.term());
    const matching = this.states().filter((s) => !term || normalize(s.name).includes(term));
    const covered = this.coveredIds();
    return {
      covered: matching.filter((s) => covered.has(s.id)),
      rest: matching.filter((s) => !covered.has(s.id)),
    };
  });

  protected toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) this.term.set('');
  }

  protected choose(state: GeoState): void {
    this.selected.set(state.id);
    this.open.set(false);
  }

  /** Enter picks the first match, so typing "mir" + Enter selects Miranda. */
  protected onSearchKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const { covered, rest } = this.groups();
    const first = covered[0] ?? rest[0];
    if (first) this.choose(first);
  }

  protected onTerm(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }
}
