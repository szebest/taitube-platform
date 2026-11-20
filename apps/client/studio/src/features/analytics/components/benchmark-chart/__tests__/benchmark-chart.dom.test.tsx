import { axeViolations } from '@kit/web-testing/dom';
import { screen, within } from '@testing-library/react';
import { getVideoBenchmark } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { renderAnalytics } from '#app/features/analytics/__tests__/render-analytics';
import { LazyBenchmarkPlot } from '#app/features/analytics/components/benchmark-plot/benchmark-plot.lazy';
import { BenchmarkChart } from '../benchmark-chart';

beforeAll(() => LazyBenchmarkPlot.preload());

const renderChart = () => renderAnalytics(<BenchmarkChart videoId={VIDEO_ID} />);

describe('apps/client/studio: BenchmarkChart', () => {
  it('lists the cumulative views of each day beside the percentiles of the earlier videos', async () => {
    serveAnalytics({ peerCount: 4 });
    await renderChart();

    const figure = await screen.findByRole('figure');
    const rows = within(within(figure).getByRole('table')).getAllByRole('row');

    expect(
      within(figure).getByText('First week against your earlier videos', {
        selector: 'figcaption',
      })
    ).toBeVisible();
    expect(rows).toHaveLength(8);
    expect(rows[0]?.textContent).toBe('DayThis video25th percentileMedian75th percentile');
    expect(rows[1]?.textContent).toBe('Day 11081014');
    expect(rows[7]?.textContent).toBe('Day 770567098');
  });

  it('draws the chart from the library once its chunk has loaded', async () => {
    serveAnalytics({ peerCount: 4 });
    const { container } = await renderChart();

    await screen.findByRole('figure');

    await vi.waitFor(() =>
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    );
  });

  it('says there are not enough earlier videos to compare under three, and still lists the views', async () => {
    serveAnalytics({ peerCount: 2 });
    await renderChart();

    expect(await screen.findByText('Not enough earlier videos to compare')).toBeVisible();
    expect(screen.getByRole('row', { name: /Day 1/ }).textContent).toBe('Day 110');
  });

  it('says there is no data yet for a video that is not ready', async () => {
    apiServer.use(
      mockEndpoint(getVideoBenchmark, () =>
        Response.json({
          videoId: VIDEO_ID,
          publishedAt: null,
          peerCount: 0,
          days: Array.from({ length: 7 }, (_, day) => ({
            day,
            views: null,
            p25: null,
            median: null,
            p75: null,
          })),
        })
      )
    );
    await renderChart();

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
  });

  it('offers a retry in the frame when the benchmark does not load', async () => {
    apiServer.use(mockEndpoint(getVideoBenchmark, () => problemReply(ErrorCodes.INTERNAL)));
    await renderChart();

    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  });

  it('passes axe', async () => {
    serveAnalytics({ peerCount: 4 });
    await renderChart();
    await screen.findByRole('figure');

    expect(await axeViolations()).toEqual([]);
  });
});
