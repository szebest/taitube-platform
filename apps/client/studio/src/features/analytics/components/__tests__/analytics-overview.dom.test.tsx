import { screen } from '@testing-library/react';
import { VIDEO_ID } from '@vp/web-testing';

import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { renderAnalytics } from '#app/features/analytics/__tests__/render-analytics';
import { AnalyticsOverview } from '../analytics-overview';

describe('apps/client/studio: AnalyticsOverview', () => {
  it.each([
    { scope: { kind: 'channel' }, asked: 'channel' },
    { scope: { kind: 'video', videoId: VIDEO_ID }, asked: 'video' },
  ] as const)(
    'shows the three cards and the views chart of the $asked',
    async ({ scope, asked }) => {
      const requests = serveAnalytics();
      await renderAnalytics(<AnalyticsOverview scope={scope} range="7d" />);

      expect(await screen.findAllByRole('figure')).toHaveLength(4);
      expect(
        screen
          .getAllByRole('figure')
          .map((figure) => figure.querySelector('figcaption')?.textContent)
      ).toEqual([
        'Views, last 7 days',
        'Watch time, last 7 days',
        'Average view duration, last 7 days',
        'Views per day',
      ]);
      expect(new Set(requests)).toEqual(new Set([{ scope: asked, range: '7d' }]));
    }
  );
});
