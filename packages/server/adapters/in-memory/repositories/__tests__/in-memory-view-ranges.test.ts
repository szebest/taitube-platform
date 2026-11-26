import { byDate, byHour, inHours, inRange } from '../in-memory-view-ranges';

describe('in-memory view ranges', () => {
  it.each([
    { viewDate: '2026-03-01', expected: true },
    { viewDate: '2026-03-05', expected: true },
    { viewDate: '2026-02-28', expected: false },
    { viewDate: '2026-03-06', expected: false },
  ])('inRange($viewDate) is $expected, both ends inclusive', ({ viewDate, expected }) => {
    expect(inRange(viewDate, { from: '2026-03-01', to: '2026-03-05' })).toBe(expected);
  });

  it.each([
    { viewHour: '2026-03-01T10:00:00.000Z', expected: true },
    { viewHour: '2026-03-01T12:00:00.000Z', expected: true },
    { viewHour: '2026-03-01T09:59:59.000Z', expected: false },
    { viewHour: '2026-03-01T12:00:01.000Z', expected: false },
  ])('inHours($viewHour) is $expected, both ends inclusive', ({ viewHour, expected }) => {
    expect(
      inHours(viewHour, { from: '2026-03-01T10:00:00.000Z', to: '2026-03-01T12:00:00.000Z' })
    ).toBe(expected);
  });

  it('byHour orders earlier hours first', () => {
    const rows = [
      { viewHour: '2026-03-01T11:00:00.000Z', views: 1 },
      { viewHour: '2026-03-01T09:00:00.000Z', views: 2 },
    ];

    expect(rows.sort(byHour).map((row) => row.views)).toEqual([2, 1]);
  });

  it('byDate orders earlier days first', () => {
    const rows = [
      { viewDate: '2026-03-02', views: 1, watchSeconds: 0 },
      { viewDate: '2026-03-01', views: 2, watchSeconds: 0 },
    ];

    expect(rows.sort(byDate).map((row) => row.views)).toEqual([2, 1]);
  });
});
