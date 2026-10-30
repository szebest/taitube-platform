import { screen, within } from '@testing-library/react';
import { getChannelAnalytics } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';

import { serveAnalytics } from '../../__tests__/analytics-api.fixture';
import { renderAnalytics } from '../../__tests__/render-analytics';
import { ViewsChart } from '../views-chart';

const renderChart = (range: '7d' | '30d' | '90d' = '30d') =>
  renderAnalytics(<ViewsChart scope={{ kind: 'channel' }} range={range} />);

describe('apps/client/studio: ViewsChart', () => {
  it('names the figure and lists every day for a reader who does not see the drawing', async () => {
    serveAnalytics({ views: [10, 0, 30] });
    await renderChart();

    const figure = await screen.findByRole('figure');
    expect(
      within(figure).getByText('Views per day', { selector: 'figcaption' })
    ).toBeInTheDocument();
    const rows = within(within(figure).getByRole('table')).getAllByRole('row');

    expect(rows.map((row) => row.textContent)).toEqual([
      'DayViews',
      'Oct 1, 202610',
      'Oct 2, 20260',
      'Oct 3, 202630',
    ]);
  });

  it('draws the chart from the library once its chunk has loaded', async () => {
    serveAnalytics();
    const { container } = await renderChart();

    await screen.findByRole('figure');

    await vi.waitFor(() =>
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    );
  });

  it('names its one series in the legend, in the first categorical colour', async () => {
    serveAnalytics();
    await renderChart();

    const legendItem = await screen.findByRole('button', { name: 'Views' });

    expect(legendItem.querySelector('circle')).toHaveStyle({
      fill: 'var(--dataviz-categorical-1)',
    });
  });

  it('keeps the frame and says there are no views yet when the range is empty', async () => {
    serveAnalytics({ views: [0, 0] });
    await renderChart();

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(screen.getByRole('figure')).toBeInTheDocument();
  });

  it('offers a retry in the frame when the views do not load', async () => {
    apiServer.use(mockEndpoint(getChannelAnalytics, () => problemReply(ErrorCodes.INTERNAL)));
    await renderChart();

    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  });

  it('shows the skeleton at the frame height while loading', async () => {
    serveAnalytics();
    const { container } = await renderChart();

    expect(container.querySelector('[data-slot="chart-skeleton"]')).toBeInTheDocument();
    await screen.findByRole('figure');
  });

  it('passes axe', async () => {
    serveAnalytics();
    await renderChart();
    await screen.findByRole('figure');

    expect(await axeViolations()).toEqual([]);
  });
});
