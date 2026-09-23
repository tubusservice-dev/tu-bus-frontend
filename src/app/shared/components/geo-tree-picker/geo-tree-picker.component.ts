import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { GeoAdminCity, GeoAdminMunicipality, GeoAdminTree } from '@models/geo.model';

type CheckState = 'all' | 'some' | 'none';

/** Accent- and case-insensitive text, so "guigue" finds Güigüe. */
const normalize = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Parish picker for one state: municipalities › cities › parishes with
 * cascading checkboxes. Checking a municipality or a city checks all its
 * parishes; a parent with only some of them checked shows as indeterminate.
 *
 * Presentational: the parent loads the tree and owns the selection
 * (`[(selected)]`, a list of parish ids). Inactive parishes are shown but
 * cannot be picked.
 */
@Component({
  selector: 'app-geo-tree-picker',
  standalone: true,
  templateUrl: './geo-tree-picker.component.html',
  styleUrl: './geo-tree-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeoTreePickerComponent {
  readonly tree = input.required<GeoAdminTree>();
  readonly selected = model<string[]>([]);
  readonly disabled = input(false);

  protected readonly searchTerm = signal('');
  protected readonly expanded = signal<Set<string>>(new Set());

  protected readonly selectedSet = computed(() => new Set(this.selected()));

  /** Municipalities (and inside them cities/parishes) matching the search. */
  protected readonly visibleMunicipalities = computed(() => {
    const term = normalize(this.searchTerm());
    const municipalities = this.tree().municipalities;
    if (!term) return municipalities;

    const matches = (name: string) => normalize(name).includes(term);
    return municipalities.flatMap((m) => {
      if (matches(m.name)) return [m];
      const cities = m.cities
        .map((c) => (matches(c.name) ? c : { ...c, parishes: c.parishes.filter((p) => matches(p.name)) }))
        .filter((c) => c.parishes.length > 0);
      return cities.length ? [{ ...m, cities }] : [];
    });
  });

  /** "14 parroquias en 3 ciudades". */
  protected readonly summary = computed(() => {
    const selected = this.selectedSet();
    let parishes = 0;
    const cities = new Set<string>();
    for (const m of this.tree().municipalities) {
      for (const c of m.cities) {
        for (const p of c.parishes) {
          if (selected.has(p.id)) {
            parishes += 1;
            cities.add(c.id);
          }
        }
      }
    }
    return { parishes, cities: cities.size };
  });

  /**
   * Municipalities with only some parishes checked. While the previous app
   * version is in use it can only see whole municipalities, so the panel
   * warns that it will treat these as fully covered.
   */
  protected readonly partialMunicipalities = computed(() =>
    this.tree().municipalities.filter((m) => this.municipalityState(m) === 'some').map((m) => m.name),
  );

  // ==================== state ====================

  protected municipalityState(m: GeoAdminMunicipality): CheckState {
    return this.stateOf(this.activeParishIds(m.cities));
  }

  protected cityState(c: GeoAdminCity): CheckState {
    return this.stateOf(this.activeParishIds([c]));
  }

  protected countOf(m: GeoAdminMunicipality): { selected: number; total: number } {
    const ids = this.activeParishIds(m.cities);
    const selected = this.selectedSet();
    return { selected: ids.filter((id) => selected.has(id)).length, total: ids.length };
  }

  /** Names of the checked parishes of a municipality, for the card preview. */
  protected selectedNames(m: GeoAdminMunicipality): string[] {
    const selected = this.selectedSet();
    return m.cities.flatMap((c) => c.parishes.filter((p) => selected.has(p.id)).map((p) => p.name));
  }

  protected isExpanded(m: GeoAdminMunicipality): boolean {
    // While searching, every match is shown open.
    return Boolean(this.searchTerm().trim()) || this.expanded().has(m.id);
  }

  // ==================== actions ====================

  protected toggleExpanded(m: GeoAdminMunicipality): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
  }

  protected toggleMunicipality(m: GeoAdminMunicipality): void {
    this.setMany(this.activeParishIds(m.cities), this.municipalityState(m) !== 'all');
  }

  protected toggleCity(c: GeoAdminCity): void {
    this.setMany(this.activeParishIds([c]), this.cityState(c) !== 'all');
  }

  protected toggleParish(parishId: string): void {
    this.setMany([parishId], !this.selectedSet().has(parishId));
  }

  protected selectAll(on: boolean): void {
    this.setMany(this.activeParishIds(this.tree().municipalities.flatMap((m) => m.cities)), on);
  }

  protected onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  // ==================== helpers ====================

  private setMany(ids: string[], on: boolean): void {
    if (this.disabled()) return;
    const next = new Set(this.selected());
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    this.selected.set([...next]);
  }

  private activeParishIds(cities: GeoAdminCity[]): string[] {
    return cities.filter((c) => c.isActive).flatMap((c) => c.parishes.filter((p) => p.isActive).map((p) => p.id));
  }

  private stateOf(ids: string[]): CheckState {
    if (!ids.length) return 'none';
    const selected = this.selectedSet();
    const count = ids.filter((id) => selected.has(id)).length;
    return count === 0 ? 'none' : count === ids.length ? 'all' : 'some';
  }
}
