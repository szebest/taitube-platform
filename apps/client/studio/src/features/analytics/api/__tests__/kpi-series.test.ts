import { channelAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { kpiSeries } from '../kpi-series';

describe('apps/client/studio: kpiSeries', () => {
  it.each([
    { metric: 'views', total: 40, daily: [10, 0, 30], previous: 20 },
    { metric: 'watch-time', total: 3600, daily: [900, 0, 2700], previous: 1800 },
    { metric: 'average-view-duration', total: 90, daily: [90, 0, 90], previous: 90 },
  ] as const)(
    'totals $metric over the range, per day and over the period before',
    ({ metric, total, daily, previous }) => {
      const analytics = channelAnalytics({
        views: [10, 0, 30],
        previous: { views: 20, netSubscribers: 0 },
      });

      expect(kpiSeries(metric, analytics)).toEqual({ total, daily, previous });
    }
  );

  it.each(['views', 'watch-time', 'average-view-duration'] as const)(
    'is zero for %s with nothing watched, and has no previous period for lifetime',
    (metric) => {
      expect(kpiSeries(metric, channelAnalytics({ views: [0, 0] }))).toEqual({
        total: 0,
        daily: [0, 0],
        previous: null,
      });
    }
  );
});
