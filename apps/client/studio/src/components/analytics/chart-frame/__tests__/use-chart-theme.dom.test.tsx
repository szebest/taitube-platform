import { renderHook } from '@testing-library/react';
import { useChartTheme } from '../use-chart-theme';

describe('apps/client/studio: useChartTheme', () => {
  it('hands a chart variable references for every palette and role, never a colour value', () => {
    const { result } = renderHook(() => useChartTheme());

    expect(result.current).toEqual({
      categorical: [1, 2, 3, 4, 5, 6].map((step) => `var(--dataviz-categorical-${step})`),
      sequential: [1, 2, 3, 4, 5].map((step) => `var(--dataviz-sequential-${step})`),
      diverging: [1, 2, 3, 4, 5].map((step) => `var(--dataviz-diverging-${step})`),
      grid: 'var(--border)',
      axis: 'var(--fg-muted)',
      tooltipSurface: 'var(--raised)',
    });
  });

  it('keeps one object across renders, so a chart memoised on it does not redraw', () => {
    const { result, rerender } = renderHook(() => useChartTheme());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
