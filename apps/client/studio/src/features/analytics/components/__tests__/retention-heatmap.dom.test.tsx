import { screen, within } from '@testing-library/react';
import { getVideoRetention } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';

import { serveAnalytics } from '../../__tests__/analytics-api.fixture';
import { renderAnalytics } from '../../__tests__/render-analytics';
import { RetentionHeatmap } from '../retention-heatmap';

const renderHeatmap = () => renderAnalytics(<RetentionHeatmap videoId={VIDEO_ID} />);

describe('apps/client/studio: RetentionHeatmap', () => {
  it('names the figure and lists the viewers left at each point for a reader who does not see the drawing', async () => {
    serveAnalytics({ retention: [100, 80, 40] });
    await renderHeatmap();

    const figure = await screen.findByRole('figure');
    const rows = within(within(figure).getByRole('table')).getAllByRole('row');

    expect(
      within(figure).getByText('Audience retention', { selector: 'figcaption' })
    ).toBeInTheDocument();
    expect(rows.map((row) => row.textContent)).toEqual([
      'Position in the videoViewers',
      '0%100',
      '5%80',
      '10%40',
    ]);
  });

  it('draws the chart from the library once its chunk has loaded', async () => {
    serveAnalytics();
    const { container } = await renderHeatmap();

    await screen.findByRole('figure');

    await vi.waitFor(() =>
      expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    );
  });

  it('says there is no data yet when nobody has played the video', async () => {
    serveAnalytics({ retention: [0, 0, 0] });
    await renderHeatmap();

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
  });

  it('offers a retry in the frame when the curve does not load', async () => {
    apiServer.use(mockEndpoint(getVideoRetention, () => problemReply(ErrorCodes.INTERNAL)));
    await renderHeatmap();

    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  });

  it('shows the skeleton while loading', async () => {
    serveAnalytics();
    const { container } = await renderHeatmap();

    expect(container.querySelector('[data-slot="chart-skeleton"]')).toBeInTheDocument();
    await screen.findByRole('figure');
  });

  it('passes axe', async () => {
    serveAnalytics();
    await renderHeatmap();
    await screen.findByRole('figure');

    expect(await axeViolations()).toEqual([]);
  });
});
