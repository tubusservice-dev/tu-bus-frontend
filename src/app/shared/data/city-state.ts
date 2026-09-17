import { VENEZUELA_STATES } from './venezuela-states';
import { toSlug } from '@shared/utils/slug.util';

/**
 * Which state a city belongs to, for grouping the location picker.
 *
 * Derived from `VENEZUELA_STATES`, the reference data the app already carries,
 * so a newly seeded city is grouped correctly without anyone remembering to
 * register it here. Only the catalogue's own inventions need listing: entries
 * that group a metropolitan area or disambiguate a name, which no reference
 * list contains.
 *
 * A city that matches nothing falls under `FALLBACK_STATE`. That is a display
 * choice, not an error — the city still appears and stays selectable.
 */

export const FALLBACK_STATE = 'Otras zonas';

/** Catalogue entries that are not real city names, so lookup cannot find them. */
const GROUPED_ENTRIES: Readonly<Record<string, string>> = {
  'guarenas-guatire': 'Miranda',
  'valles-del-tuy': 'Miranda',
  'miranda-carabobo': 'Carabobo',
};

/** citySlug → state name, built once from the reference data. */
const BY_SLUG: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const state of VENEZUELA_STATES) {
    for (const city of state.cities) {
      map.set(toSlug(city), state.name);
    }
  }
  // Grouped entries win: they are deliberate overrides.
  for (const [slug, state] of Object.entries(GROUPED_ENTRIES)) {
    map.set(slug, state);
  }
  return map;
})();

/**
 * States in the order they should appear, most served first. Anything else —
 * including `FALLBACK_STATE` — sorts alphabetically after these.
 */
const STATE_ORDER: readonly string[] = ['Distrito Capital', 'Miranda', 'Carabobo', 'Aragua', 'Lara'];

export const stateOf = (citySlug: string): string => BY_SLUG.get(citySlug) ?? FALLBACK_STATE;

/** Sort key for a state heading: listed ones first, in order; the rest by name. */
export const stateRank = (state: string): number => {
  const index = STATE_ORDER.indexOf(state);
  return index === -1 ? STATE_ORDER.length : index;
};
