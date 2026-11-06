import { screen, within } from '@testing-library/react';
import { getChannelAnalytics } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';
import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { renderAnalytics } from '#app/features/analytics/__tests__/render-analytics';
import type { ViewsGranularity } from '#app/features/analytics/types';
import { ViewsChart } from '../views-chart';

const renderChart = (granularity: ViewsGranularity = 'day') =>
  renderAnalytics(<ViewsChart scope={{ kind: 'channel' }} range="30d" granularity={granularity} />);

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

  it('names the hourly figure and lists each of the 48 hours, oldest first', async () => {
    serveAnalytics({ hourly: [4, 0, 7] });
    await renderChart('hour');

    const figure = await screen.findByRole('figure');
    expect(
      within(figure).getByText('Views per hour, last 48 hours', { selector: 'figcaption' })
    ).toBeInTheDocument();
    const rows = within(within(figure).getByRole('table')).getAllByRole('row');

    expect(rows).toHaveLength(49);
    expect(rows.slice(0, 4).map((row) => row.textContent)).toEqual([
      'HourViews',
      'Oct 2, 12 AM4',
      'Oct 2, 1 AM0',
      'Oct 2, 2 AM7',
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

  it.each([
    { granularity: 'day', fixture: { views: [0, 0], hourly: [5] } },
    { granularity: 'hour', fixture: { views: [5], hourly: [] } },
  ] as const)(
    'keeps the $granularity frame and says there are no views yet when it is empty',
    async ({ granularity, fixture }) => {
      serveAnalytics(fixture);
      await renderChart(granularity);

      expect(await screen.findByText('No data yet')).toBeInTheDocument();
      expect(screen.getByRole('figure')).toBeInTheDocument();
    }
  );

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
