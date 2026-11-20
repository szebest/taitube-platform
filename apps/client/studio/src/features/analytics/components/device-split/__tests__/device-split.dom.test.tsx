import { axeViolations } from '@kit/web-testing/dom';
import { screen, within } from '@testing-library/react';
import { getVideoAudience } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { renderAnalytics } from '#app/features/analytics/__tests__/render-analytics';
import { DeviceSplit } from '../device-split';

const renderSplit = () => renderAnalytics(<DeviceSplit videoId={VIDEO_ID} range="30d" />);

const rowsOf = async () => {
  const figure = await screen.findByRole('figure');
  return within(within(figure).getByRole('table'))
    .getAllByRole('row')
    .map((row) => row.textContent);
};

describe('apps/client/studio: DeviceSplit', () => {
  it('names the figure and lists each device with its views and share, most viewed first', async () => {
    serveAnalytics({
      devices: [
        { device: 'mobile', views: 6, share: 0.6 },
        { device: 'desktop', views: 4, share: 0.4 },
      ],
    });
    await renderSplit();

    expect(await screen.findByText('Views by device', { selector: 'figcaption' })).toBeVisible();
    expect(await rowsOf()).toEqual(['DeviceViewsShare', 'Mobile660%', 'Desktop440%', 'Tablet00%']);
  });

  it('adds the row of views no device was reported for when they are part of the range', async () => {
    serveAnalytics({
      devices: [
        { device: 'desktop', views: 5, share: 0.5 },
        { device: 'unknown', views: 5, share: 0.5 },
      ],
    });
    await renderSplit();

    expect(await rowsOf()).toContain('Not reported550%');
  });

  it('says there is no data yet when every view is of an unreported device', async () => {
    serveAnalytics({ devices: [{ device: 'unknown', views: 5, share: 1 }] });
    await renderSplit();

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(screen.queryByText('Not reported')).not.toBeInTheDocument();
  });

  it('offers a retry in the frame when the split does not load', async () => {
    apiServer.use(mockEndpoint(getVideoAudience, () => problemReply(ErrorCodes.INTERNAL)));
    await renderSplit();

    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  });

  it('shows the skeleton while loading', async () => {
    serveAnalytics();
    const { container } = await renderSplit();

    expect(container.querySelector('[data-slot="chart-skeleton"]')).toBeInTheDocument();
    await screen.findByRole('figure');
  });

  it('passes axe', async () => {
    serveAnalytics();
    await renderSplit();
    await screen.findByRole('figure');

    expect(await axeViolations()).toEqual([]);
  });
});
