import { FALLBACK_STATE, stateOf, stateRank } from './city-state';

/**
 * The location picker groups cities under their state. The mapping is derived
 * from the reference data the app already ships, so a newly seeded city is
 * grouped without anyone registering it by hand — that is the property worth
 * pinning, since the previous approach (a hand-kept list) silently dropped
 * whatever nobody remembered to add.
 */
describe('stateOf()', () => {
  it('resolves cities from the reference data without a hand-kept list', () => {
    expect(stateOf('caracas')).toBe('Distrito Capital');
    expect(stateOf('valencia')).toBe('Carabobo');
    expect(stateOf('puerto-cabello')).toBe('Carabobo');
    expect(stateOf('moron')).toBe('Carabobo');
    expect(stateOf('maracay')).toBe('Aragua');
    expect(stateOf('barquisimeto')).toBe('Lara');
  });

  it('resolves the catalogue groupings that no reference list contains', () => {
    // Metropolitan areas and disambiguated names are the catalogue's own
    // inventions, so they are the only entries that need listing.
    expect(stateOf('guarenas-guatire')).toBe('Miranda');
    expect(stateOf('valles-del-tuy')).toBe('Miranda');
    expect(stateOf('miranda-carabobo')).toBe('Carabobo');
  });

  it('falls back instead of hiding a city nobody mapped', () => {
    // A city seeded tomorrow still renders and stays selectable.
    expect(stateOf('ciudad-que-no-existe-todavia')).toBe(FALLBACK_STATE);
  });
});

describe('stateRank()', () => {
  it('puts the most served states first', () => {
    expect(stateRank('Distrito Capital')).toBeLessThan(stateRank('Carabobo'));
    expect(stateRank('Carabobo')).toBeLessThan(stateRank('Lara'));
  });

  it('sends unlisted states, and the fallback, to the end', () => {
    expect(stateRank('Zulia')).toBeGreaterThan(stateRank('Lara'));
    expect(stateRank(FALLBACK_STATE)).toBeGreaterThan(stateRank('Lara'));
  });
});
