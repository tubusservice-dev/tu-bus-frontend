import { LocationRef, StoredLocation } from '@models/geo.model';

/** The flat shape orders and profiles keep on the server. */
export function toStoredLocation(ref: LocationRef): StoredLocation {
  return {
    state: ref.state.id,
    stateName: ref.state.name,
    municipality: ref.municipality.id,
    municipalityName: ref.municipality.name,
    ...(ref.city ? { city: ref.city.id, cityName: ref.city.name } : {}),
    ...(ref.parish ? { parish: ref.parish.id, parishName: ref.parish.name } : {}),
  };
}

/** Back to the cascade's value. */
export function fromStoredLocation(stored: StoredLocation): LocationRef {
  return {
    state: { id: stored.state, name: stored.stateName },
    municipality: { id: stored.municipality, name: stored.municipalityName },
    ...(stored.city ? { city: { id: stored.city, name: stored.cityName ?? '' } } : {}),
    ...(stored.parish ? { parish: { id: stored.parish, name: stored.parishName ?? '' } } : {}),
  };
}

/** "Tocuyito, parroquia Independencia" — the city and parish part of an address line. */
export function cityAndParishLabel(ref: LocationRef): string {
  const city = ref.city?.name ?? ref.municipality.name;
  return ref.parish ? `${city}, parroquia ${ref.parish.name}` : city;
}
