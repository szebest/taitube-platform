import { render } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { BenchmarkPlot } from '../benchmark-plot';

describe('apps/client/studio: BenchmarkPlot', () => {
  it('fills the plot area the frame reserves for it', () => {
    const { container } = render(
      <AppProviders>
        <BenchmarkPlot
          points={[
            { day: 0, views: 4, median: 5, band: [3, 8] },
            { day: 1, views: null, median: 9, band: [6, 12] },
          ]}
          names={{ views: 'This video', median: 'Median', band: 'Middle half' }}
          dayLabel={(day) => `Day ${day + 1}`}
        />
      </AppProviders>
    );

    expect(container.querySelector('.recharts-responsive-container')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
  });
});
