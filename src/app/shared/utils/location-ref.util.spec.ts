import { LocationRef } from '@models/geo.model';
import { cityAndParishLabel, fromStoredLocation, toStoredLocation } from './location-ref.util';

const FULL: LocationRef = {
  state: { id: 's', name: 'Carabobo' },
  municipality: { id: 'm', name: 'Libertador' },
  city: { id: 'c', name: 'Tocuyito' },
  parish: { id: 'p', name: 'Independencia' },
};

describe('location-ref util', () => {
  it('flattens a place for the server and back', () => {
    expect(toStoredLocation(FULL)).toEqual({
      state: 's',
      stateName: 'Carabobo',
      municipality: 'm',
      municipalityName: 'Libertador',
      city: 'c',
      cityName: 'Tocuyito',
      parish: 'p',
      parishName: 'Independencia',
    });
    expect(fromStoredLocation(toStoredLocation(FULL))).toEqual(FULL);
  });

  it('leaves out the levels a form did not ask for', () => {
    const { city, parish, ...stateAndMunicipality } = FULL;
    expect(toStoredLocation(stateAndMunicipality)).toEqual({ state: 's', stateName: 'Carabobo', municipality: 'm', municipalityName: 'Libertador' });
    expect(city && parish).toBeTruthy();
  });

  it('labels the city and parish of an address', () => {
    expect(cityAndParishLabel(FULL)).toBe('Tocuyito, parroquia Independencia');
    expect(cityAndParishLabel({ state: FULL.state, municipality: FULL.municipality })).toBe('Libertador');
  });
});
