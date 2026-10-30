import { CHART_SERIES, seriesColor } from '../series-color';

describe('apps/client/studio: seriesColor', () => {
  it.each(CHART_SERIES)('paints series %i with its categorical variable', (series) => {
    expect(seriesColor(series)).toBe(`var(--dataviz-categorical-${series + 1})`);
  });
});
