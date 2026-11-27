import { screen } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';
import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { renderAnalytics } from '#app/features/analytics/__tests__/render-analytics';
import { AnalyticsOverview } from '../analytics-overview';

describe('apps/client/studio: AnalyticsOverview', () => {
  it.each([
    {
      scope: { kind: 'channel' },
      asked: 'channel',
      figures: [
        'Views, last 7 days',
        'Watch time, last 7 days',
        'Average view duration, last 7 days',
        'Net subscribers, last 7 days',
        'Views per day',
        'Views per hour, last 48 hours',
      ],
    },
    {
      scope: { kind: 'video', videoId: VIDEO_ID },
      asked: 'video',
      figures: [
        'Views, last 7 days',
        'Watch time, last 7 days',
        'Average view duration, last 7 days',
        'Views per day',
        'Views per hour, last 48 hours',
      ],
    },
  ] as const)(
    'shows the figures, the daily and the hourly views of the $asked',
    async ({ scope, asked, figures }) => {
      const requests = serveAnalytics();
      await renderAnalytics(<AnalyticsOverview scope={scope} range="7d" />);

      expect(await screen.findAllByRole('figure')).toHaveLength(figures.length);
      expect(
        screen
          .getAllByRole('figure')
          .map((figure) => figure.querySelector('figcaption')?.textContent)
      ).toEqual(figures);
      expect(new Set(requests)).toEqual(new Set([{ scope: asked, range: '7d' }]));
    }
  );

  it.each([
    { scope: { kind: 'channel' }, asked: 'channel' },
    { scope: { kind: 'video', videoId: VIDEO_ID }, asked: 'video' },
  ] as const)(
    'says nothing has been watched, instead of drawing zeros, for a $asked with no views in the range',
    async ({ scope }) => {
      serveAnalytics({ views: [0, 0, 0] });
      await renderAnalytics(<AnalyticsOverview scope={scope} range="7d" />);

      expect(
        await screen.findByRole('heading', { name: 'No views in this range yet' })
      ).toBeVisible();
      expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    }
  );

  it('keeps the figures once there is a single view in the range', async () => {
    serveAnalytics({ views: [0, 1, 0] });
    await renderAnalytics(<AnalyticsOverview scope={{ kind: 'channel' }} range="7d" />);

    expect(await screen.findAllByRole('figure')).not.toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'No views in this range yet' })).toBeNull();
  });
});
