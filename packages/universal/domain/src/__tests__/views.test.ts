import {
  type AnalyticsRange,
  averageRetention,
  fillTimeline,
  mergeViewCounts,
  rangeDays,
  sumViews,
  viewDateOf,
  viewDateRange,
  viewsByVideo,
} from '../views';

const TODAY = new Date('2026-03-10T23:59:59.000Z');

describe('domain: views', () => {
  it('buckets an instant into its UTC day', () => {
    expect(viewDateOf(new Date('2026-03-10T00:00:00.000Z'))).toBe('2026-03-10');
    expect(viewDateOf(TODAY)).toBe('2026-03-10');
  });

  it.each<[AnalyticsRange, string, number]>([
    ['7d', '2026-03-04', 7],
    ['30d', '2026-02-09', 30],
    ['90d', '2025-12-11', 90],
  ])('spans %s back from today, today included', (range, from, days) => {
    expect(viewDateRange(range, TODAY)).toEqual({ from, to: '2026-03-10' });
    expect(rangeDays(range)).toBe(days);
    expect(fillTimeline(viewDateRange(range, TODAY), [])).toHaveLength(days);
  });

  it('fills the days without a row with zero, oldest first', () => {
    const timeline = fillTimeline({ from: '2026-02-27', to: '2026-03-02' }, [
      { viewDate: '2026-03-01', views: 4, watchSeconds: 40 },
    ]);

    expect(timeline).toEqual([
      { viewDate: '2026-02-27', views: 0, watchSeconds: 0 },
      { viewDate: '2026-02-28', views: 0, watchSeconds: 0 },
      { viewDate: '2026-03-01', views: 4, watchSeconds: 40 },
      { viewDate: '2026-03-02', views: 0, watchSeconds: 0 },
    ]);
  });

  it('merges repeated counts of one video and day', () => {
    expect(
      mergeViewCounts([
        { videoId: 'a', viewDate: '2026-03-01', views: 1, watchSeconds: 5 },
        { videoId: 'b', viewDate: '2026-03-01', views: 2, watchSeconds: 6 },
        { videoId: 'a', viewDate: '2026-03-01', views: 3, watchSeconds: 7 },
      ])
    ).toEqual([
      { videoId: 'a', viewDate: '2026-03-01', views: 4, watchSeconds: 12 },
      { videoId: 'b', viewDate: '2026-03-01', views: 2, watchSeconds: 6 },
    ]);
  });

  it('totals each video across days, ordered by id', () => {
    expect(
      viewsByVideo([
        { videoId: 'b', viewDate: '2026-03-01', views: 2, watchSeconds: 0 },
        { videoId: 'a', viewDate: '2026-03-01', views: 1, watchSeconds: 0 },
        { videoId: 'b', viewDate: '2026-03-02', views: 5, watchSeconds: 0 },
      ])
    ).toEqual([
      { videoId: 'a', views: 1 },
      { videoId: 'b', views: 7 },
    ]);
  });

  it('sums views and watch time across days', () => {
    expect(
      sumViews([
        { viewDate: '2026-03-01', views: 2, watchSeconds: 30 },
        { viewDate: '2026-03-02', views: 3, watchSeconds: 45 },
      ])
    ).toEqual({ views: 5, watchSeconds: 75 });
  });

  it.each([
    { totals: { views: 2, watchSeconds: 60 }, durationMs: 60_000, retention: 0.5 },
    { totals: { views: 1, watchSeconds: 90 }, durationMs: 60_000, retention: 1 },
    { totals: { views: 0, watchSeconds: 0 }, durationMs: 60_000, retention: null },
    { totals: { views: 3, watchSeconds: 30 }, durationMs: null, retention: null },
  ])(
    'reads a retention of $retention from $totals over $durationMs ms',
    ({ totals, durationMs, retention }) => {
      expect(averageRetention(totals, durationMs)).toBe(retention);
    }
  );
});
