import { dailyViews } from '../../__tests__/analytics-api.fixture';
import { kpiSeries } from '../kpi-series';

const timeline = dailyViews([10, 0, 30]);

describe('apps/client/studio: kpiSeries', () => {
  it.each([
    { metric: 'views', total: 40, daily: [10, 0, 30] },
    { metric: 'watch-time', total: 3600, daily: [900, 0, 2700] },
    { metric: 'average-view-duration', total: 90, daily: [90, 0, 90] },
  ] as const)('totals $metric over the range and gives it per day', ({ metric, total, daily }) => {
    expect(kpiSeries(metric, timeline)).toEqual({ total, daily });
  });

  it.each(['views', 'watch-time', 'average-view-duration'] as const)(
    'is zero for %s with nothing watched',
    (metric) => {
      expect(kpiSeries(metric, dailyViews([0, 0]))).toEqual({ total: 0, daily: [0, 0] });
    }
  );
});
