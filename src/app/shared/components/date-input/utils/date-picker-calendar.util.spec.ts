import {
  buildDayCells,
  buildMonthCells,
  buildYearCells,
  canNavigateNext,
  canNavigatePrev,
  computeInitialAnchor,
  getYearRange,
  shiftMonth,
  YEAR_PAGE_SIZE,
} from './date-picker-calendar.util';

const NO_LIMITS = { draft: '', today: '', minBound: null, maxBound: null, closedDows: [] };

describe('date-picker calendar util', () => {
  it('pages years in blocks of sixteen around the viewed year', () => {
    expect(getYearRange(2026)).toEqual({ start: 2019, end: 2034 });
    expect(getYearRange(2026).end - getYearRange(2026).start + 1).toBe(YEAR_PAGE_SIZE);
  });

  it('builds a Monday-first six-week grid with the neighbouring days', () => {
    // September 2026 starts on a Tuesday
    const cells = buildDayCells(2026, 8, { ...NO_LIMITS, draft: '2026-09-15', today: '2026-09-25' });
    expect(cells.length).toBe(42);
    expect(cells[0]).toEqual(jasmine.objectContaining({ iso: '2026-08-31', isCurrentMonth: false }));
    expect(cells[1]).toEqual(jasmine.objectContaining({ iso: '2026-09-01', isCurrentMonth: true }));
    expect(cells.find((c) => c.isSelected)?.iso).toBe('2026-09-15');
    expect(cells.find((c) => c.isToday)?.iso).toBe('2026-09-25');
    expect(cells[41].iso).toBe('2026-10-11');
  });

  it('disables days outside the bounds and on closed weekdays', () => {
    const cells = buildDayCells(2026, 8, {
      ...NO_LIMITS,
      minBound: '2026-09-10',
      maxBound: '2026-09-20',
      closedDows: [0],
    });
    const byIso = (iso: string) => cells.find((c) => c.iso === iso)!;
    expect(byIso('2026-09-09').isDisabled).toBeTrue();
    expect(byIso('2026-09-10').isDisabled).toBeFalse();
    expect(byIso('2026-09-13').isDisabled).toBeTrue(); // Sunday
    expect(byIso('2026-09-21').isDisabled).toBeTrue();
  });

  it('disables only the months fully outside the bounds', () => {
    const cells = buildMonthCells(2026, '2026-03-05', new Date(2026, 8, 25), '2026-02-15', '2026-11-01');
    expect(cells.map((c) => c.isDisabled)).toEqual([
      true, false, false, false, false, false, false, false, false, false, false, true,
    ]);
    expect(cells[2].isSelected).toBeTrue();
    expect(cells[8].isCurrent).toBeTrue();
  });

  it('marks the viewed year as selected when there is no draft', () => {
    const cells = buildYearCells({ start: 2019, end: 2034 }, '', 2026, 2026, '2020-01-01', null);
    expect(cells.find((c) => c.isSelected)?.year).toBe(2026);
    expect(cells[0].isDisabled).toBeTrue();
    expect(cells[1].isDisabled).toBeFalse();
  });

  it('blocks navigation past the bounds for each view', () => {
    const view = { year: 2026, month: 8 };
    const range = getYearRange(2026);
    expect(canNavigatePrev('days', view, range, null)).toBeTrue();
    expect(canNavigatePrev('days', view, range, '2026-09-01')).toBeFalse();
    expect(canNavigatePrev('months', view, range, '2026-01-01')).toBeFalse();
    expect(canNavigatePrev('years', view, range, '2010-01-01')).toBeTrue();
    expect(canNavigateNext('days', view, range, '2026-09-30')).toBeFalse();
    expect(canNavigateNext('days', view, range, '2026-10-01')).toBeTrue();
    expect(canNavigateNext('years', view, range, '2034-12-31')).toBeFalse();
  });

  it('rolls the year over when shifting months', () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 5 }, 1)).toEqual({ year: 2026, month: 6 });
  });

  it('clamps the opening date into the bounds', () => {
    const today = new Date(2026, 8, 25);
    expect(computeInitialAnchor(today, null, '2008-09-25').getFullYear()).toBe(2008);
    expect(computeInitialAnchor(today, '2027-01-01', null).getFullYear()).toBe(2027);
    expect(computeInitialAnchor(today, null, null)).toBe(today);
  });
});
