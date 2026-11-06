import { render } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { hourlyViews } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { ViewsPlot } from '../views-plot';

describe('apps/client/studio: ViewsPlot', () => {
  it('fills the plot area the frame reserves for it', () => {
    const { container } = render(
      <AppProviders>
        <ViewsPlot
          points={hourlyViews([1, 2, 3]).map(({ viewHour, views }) => ({ at: viewHour, views }))}
          name="Views"
          tick={(at) => ({ type: 'time', value: at })}
          label={(at) => ({ type: 'dateTime', value: at })}
        />
      </AppProviders>
    );

    expect(container.querySelector('.recharts-responsive-container')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
  });
});
