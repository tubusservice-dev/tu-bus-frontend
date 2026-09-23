import { zoneStateLabel } from './zone-states.util';

describe('zoneStateLabel', () => {
  const names = new Map([
    ['dc', 'Distrito Capital'],
    ['mir', 'Miranda'],
  ]);

  it('joins every state of the zone', () => {
    expect(zoneStateLabel(['dc', 'mir'], names)).toBe('Distrito Capital + Miranda');
  });

  it('names a single state as is', () => {
    expect(zoneStateLabel(['mir'], names)).toBe('Miranda');
  });

  it('falls back when the zone has no known state yet', () => {
    expect(zoneStateLabel(undefined, names)).toBe('Sin parroquias');
    expect(zoneStateLabel(['unknown'], names)).toBe('Sin parroquias');
  });
});
