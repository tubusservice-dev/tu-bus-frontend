import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { CityDeliveryConfig, DeliveryTerms, GeoAdminTree } from '@models/geo.model';
import { zoneCities } from './city-config.util';

/** How a city or parish is served, as the admin thinks of it. */
export type DeliveryMode = 'free' | 'paid' | 'none';

const modeOf = (t: DeliveryTerms): DeliveryMode => (!t.hasDelivery ? 'none' : t.freeDelivery ? 'free' : 'paid');

/** Terms for a mode; a paid mode keeps the charge the row already had. */
const termsFor = (mode: DeliveryMode, current: DeliveryTerms): DeliveryTerms => {
  if (mode === 'none') return { hasDelivery: false, freeDelivery: false, deliveryCharge: 0 };
  if (mode === 'free') return { hasDelivery: true, freeDelivery: true, deliveryCharge: 0 };
  return { hasDelivery: true, freeDelivery: false, deliveryCharge: current.deliveryCharge };
};

/**
 * Delivery of one branch in one zone, as a table: one row per city (free,
 * with a charge, or no delivery) and, under it, the parishes that differ.
 *
 * Presentational: the parent owns `[(config)]`, already aligned with the zone
 * (see alignCityConfig), and saves it.
 */
@Component({
  selector: 'app-branch-zone-delivery',
  standalone: true,
  templateUrl: './branch-zone-delivery.component.html',
  styleUrl: './branch-zone-delivery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchZoneDeliveryComponent {
  /** One tree per state of the zone. */
  readonly trees = input.required<GeoAdminTree[]>();
  readonly zoneParishes = input.required<string[]>();
  readonly config = model.required<CityDeliveryConfig[]>();

  protected readonly openCities = signal<Set<string>>(new Set());
  protected readonly cities = computed(() => zoneCities(this.trees(), this.zoneParishes()));
  /** With several states, each row says which one its city is in. */
  protected readonly spansStates = computed(() => this.trees().length > 1);
  protected readonly hasExceptions = computed(() => this.config().some((c) => c.parishOverrides.length > 0));

  protected readonly modes: Array<{ id: DeliveryMode; label: string }> = [
    { id: 'free', label: 'Gratis' },
    { id: 'paid', label: 'Con tarifa' },
    { id: 'none', label: 'No llega' },
  ];

  protected termsOf(cityId: string): CityDeliveryConfig | undefined {
    return this.config().find((c) => c.city === cityId);
  }

  protected overrideOf(cityId: string, parishId: string): DeliveryTerms | undefined {
    return this.termsOf(cityId)?.parishOverrides.find((o) => o.parish === parishId);
  }

  protected modeOf(terms: DeliveryTerms): DeliveryMode {
    return modeOf(terms);
  }

  protected isOpen(cityId: string): boolean {
    return this.openCities().has(cityId);
  }

  protected toggleOpen(cityId: string): void {
    this.openCities.update((set) => {
      const next = new Set(set);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
  }

  // ==================== city ====================

  protected setCityMode(cityId: string, mode: DeliveryMode): void {
    this.updateCity(cityId, (c) => ({ ...c, ...termsFor(mode, c) }));
  }

  protected onCityCharge(cityId: string, event: Event): void {
    const deliveryCharge = this.readCharge(event);
    this.updateCity(cityId, (c) => ({ ...c, deliveryCharge }));
  }

  // ==================== parish exceptions ====================

  /** "Igual que la ciudad" removes the exception; any other mode creates or updates it. */
  protected setParishMode(cityId: string, parishId: string, mode: DeliveryMode | 'inherit'): void {
    this.updateCity(cityId, (c) => {
      const rest = c.parishOverrides.filter((o) => o.parish !== parishId);
      if (mode === 'inherit') return { ...c, parishOverrides: rest };
      const current = c.parishOverrides.find((o) => o.parish === parishId) ?? c;
      return { ...c, parishOverrides: [...rest, { parish: parishId, ...termsFor(mode, current) }] };
    });
  }

  protected onParishCharge(cityId: string, parishId: string, event: Event): void {
    const deliveryCharge = this.readCharge(event);
    this.updateCity(cityId, (c) => ({
      ...c,
      parishOverrides: c.parishOverrides.map((o) => (o.parish === parishId ? { ...o, deliveryCharge } : o)),
    }));
  }

  private updateCity(cityId: string, change: (c: CityDeliveryConfig) => CityDeliveryConfig): void {
    this.config.update((config) => config.map((c) => (c.city === cityId ? change(c) : c)));
  }

  /** Non-negative, two decimals; an empty or invalid field counts as 0. */
  private readCharge(event: Event): number {
    const value = Number.parseFloat((event.target as HTMLInputElement).value);
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
  }
}
