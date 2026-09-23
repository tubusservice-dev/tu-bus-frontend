import { CityDeliveryConfig, GeoAdminCity, GeoAdminTree, NEW_CITY_TERMS } from '@models/geo.model';

/** A city of the zone as the delivery editor shows it: its parishes in the zone only. */
export interface ZoneCity {
  city: GeoAdminCity;
  municipalityName: string;
  stateName: string;
  parishes: Array<{ id: string; name: string }>;
}

/**
 * Cities with at least one parish in the zone, state by state in tree order.
 * A zone may span several states, so it takes the tree of each of them.
 */
export function zoneCities(trees: readonly GeoAdminTree[], zoneParishes: readonly string[]): ZoneCity[] {
  const inZone = new Set(zoneParishes);
  return trees.flatMap((tree) =>
    tree.municipalities.flatMap((m) =>
      m.cities
        .map((city) => ({
          city,
          municipalityName: m.name,
          stateName: tree.state.name,
          parishes: city.parishes.filter((p) => inZone.has(p.id)).map((p) => ({ id: p.id, name: p.name })),
        }))
        .filter((zc) => zc.parishes.length > 0),
    ),
  );
}

/**
 * One entry per city of the zone: existing terms are kept, new cities get the
 * default (free delivery), cities and exceptions no longer in the zone go.
 * Mirrors the server's `alignCityConfig`, so what the panel shows is what it saves.
 */
export function alignCityConfig(
  trees: readonly GeoAdminTree[],
  config: readonly CityDeliveryConfig[],
  zoneParishes: readonly string[],
): CityDeliveryConfig[] {
  const inZone = new Set(zoneParishes);
  return zoneCities(trees, zoneParishes).map(({ city }) => {
    const current = config.find((c) => c.city === city.id);
    return current
      ? { ...current, parishOverrides: current.parishOverrides.filter((o) => inZone.has(o.parish)) }
      : { city: city.id, ...NEW_CITY_TERMS, parishOverrides: [] };
  });
}
