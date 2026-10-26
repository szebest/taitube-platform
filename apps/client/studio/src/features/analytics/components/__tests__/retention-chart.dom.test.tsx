import { render, screen } from '@testing-library/react';

import { AppProviders } from '#app/__tests__/providers';
import { RetentionChart } from '../retention-chart';

function renderChart(curve: { percent: number; viewers: number }[]) {
  return render(
    <AppProviders>
      <RetentionChart curve={curve} />
    </AppProviders>
  );
}

describe('apps/client/studio: RetentionChart', () => {
  it('draws the viewers who reached each step, scaled to the viewers at the start', () => {
    const { container } = renderChart([
      { percent: 0, viewers: 100 },
      { percent: 50, viewers: 50 },
      { percent: 100, viewers: 0 },
    ]);

    expect(
      screen.getByRole('img', { name: 'Viewers who reached each point of the video' })
    ).toBeInTheDocument();
    expect(container.querySelector('polyline')).toHaveAttribute('points', '0,0 50,20 100,40');
  });

  it('says there is no playback data when nobody started the video', () => {
    const { container } = renderChart([{ percent: 0, viewers: 0 }]);

    expect(screen.getByText('No playback data yet')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });
});
