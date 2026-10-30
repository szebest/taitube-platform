import { render } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { dailyViews } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { ViewsPlot } from '../views-plot';

describe('apps/client/studio: ViewsPlot', () => {
  it('fills the plot area the frame reserves for it', () => {
    const { container } = render(
      <AppProviders>
        <ViewsPlot timeline={dailyViews([1, 2, 3])} name="Views" />
      </AppProviders>
    );

    expect(container.querySelector('.recharts-responsive-container')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
  });
});
