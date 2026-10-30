import { render } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { RetentionPlot } from '../retention-plot';

describe('apps/client/studio: RetentionPlot', () => {
  it('fills the plot area the frame reserves for it', () => {
    const { container } = render(
      <AppProviders>
        <RetentionPlot
          curve={[
            { percent: 0, viewers: 10 },
            { percent: 5, viewers: 4 },
          ]}
          name="Viewers"
        />
      </AppProviders>
    );

    expect(container.querySelector('.recharts-responsive-container')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
  });
});
