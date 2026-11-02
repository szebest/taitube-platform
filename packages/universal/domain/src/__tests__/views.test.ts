import {
  type AnalyticsRange,
  analyticsPeriods,
  averageRetention,
  mergeViewCounts,
  periodsSpan,
  summarizeViews,
  sumViews,
  viewBucketsOf,
  viewDateOf,
  viewsByVideo,
} from '../views';

const TODAY = new Date('2026-03-10T23:59:59.000Z');

describe('domain: views', () => {
  it('buckets an instant into its UTC day', () => {
    expect(viewDateOf(new Date('2026-03-10T00:00:00.000Z'))).toBe('2026-03-10');
    expect(viewDateOf(TODAY)).toBe('2026-03-10');
  });

  it('reads the day and the hour of a view from one instant', () => {
    expect(viewBucketsOf(TODAY)).toEqual({
      viewDate: '2026-03-10',
      viewHour: '2026-03-10T23:00:00.000Z',
    });
  });

  it.each<[AnalyticsRange, string, string, string]>([
    ['7d', '2026-03-04', '2026-02-25', '2026-03-03'],
    ['30d', '2026-02-09', '2026-01-10', '2026-02-08'],
    ['90d', '2025-12-11', '2025-09-12', '2025-12-10'],
  ])(
    'spans %s back from today, today included, after a previous period as long',
    (range, from, previousFrom, previousTo) => {
      const periods = analyticsPeriods(range, TODAY);

      expect(periods).toEqual({
        current: { from, to: '2026-03-10' },
        previous: { from: previousFrom, to: previousTo },
      });
      expect(periodsSpan(periods)).toEqual({ from: previousFrom, to: '2026-03-10' });
    }
  );

  it('reads lifetime from the start of time, with no previous period', () => {
    const periods = analyticsPeriods('lifetime', TODAY);

    expect(periods).toEqual({ current: { from: '1970-01-01', to: '2026-03-10' }, previous: null });
    expect(periodsSpan(periods)).toEqual(periods.current);
  });

  it('splits the rows into the timeline and the previous period total', () => {
    const summary = summarizeViews(analyticsPeriods('7d', TODAY), [
      { viewDate: '2026-02-24', views: 100, watchSeconds: 100 },
      { viewDate: '2026-02-25', views: 2, watchSeconds: 20 },
      { viewDate: '2026-03-03', views: 3, watchSeconds: 30 },
      { viewDate: '2026-03-04', views: 5, watchSeconds: 50 },
    ]);

    expect(summary.from).toBe('2026-03-04');
    expect(summary.timeline).toHaveLength(7);
    expect(sumViews(summary.timeline)).toEqual({ views: 5, watchSeconds: 50 });
    expect(summary.previous).toEqual({ views: 5, watchSeconds: 50 });
  });

  it('starts a lifetime timeline at its first counted day, today when none', () => {
    const lifetime = analyticsPeriods('lifetime', TODAY);
    const counted = summarizeViews(lifetime, [
      { viewDate: '2026-03-09', views: 1, watchSeconds: 0 },
      { viewDate: '2026-03-08', views: 2, watchSeconds: 0 },
    ]);

    expect(counted).toMatchObject({ from: '2026-03-08', to: '2026-03-10', previous: null });
    expect(counted.timeline.map((day) => day.views)).toEqual([2, 1, 0]);
    expect(summarizeViews(lifetime, []).timeline).toEqual([
      { viewDate: '2026-03-10', views: 0, watchSeconds: 0 },
    ]);
  });

  it('fills the days without a row with zero, oldest first', () => {
    const { timeline } = summarizeViews(
      {
        current: { from: '2026-02-27', to: '2026-03-02' },
        previous: { from: '2026-02-23', to: '2026-02-26' },
      },
      [{ viewDate: '2026-03-01', views: 4, watchSeconds: 40 }]
    );

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
