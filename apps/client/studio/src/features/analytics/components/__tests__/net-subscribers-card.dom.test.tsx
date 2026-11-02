import { screen } from '@testing-library/react';
import { getChannelAnalytics } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';

import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { renderAnalytics } from '#app/features/analytics/__tests__/render-analytics';
import type { AnalyticsRange } from '#app/features/analytics/types';
import { NetSubscribersCard } from '../net-subscribers-card';

const renderCard = (range: AnalyticsRange = '30d') =>
  renderAnalytics(<NetSubscribersCard range={range} />);

describe('apps/client/studio: NetSubscribersCard', () => {
  it.each([
    { netSubscribers: 12, previous: 5, value: '+12', change: '+7', trend: 'up' },
    { netSubscribers: -3, previous: 4, value: '-3', change: '-7', trend: 'down' },
    { netSubscribers: 0, previous: 0, value: '0', change: '0', trend: 'flat' },
  ] as const)(
    'shows $value gained minus lost, $change against the previous period',
    async ({ netSubscribers, previous, value, change, trend }) => {
      serveAnalytics({ netSubscribers, previous: { views: 0, netSubscribers: previous } });
      const { container } = await renderCard();

      const figure = await screen.findByRole('figure');
      const delta = container.querySelector('[data-slot="stat-card-delta"]');

      expect(figure).toHaveTextContent(`Net subscribers, last 30 days${value}`);
      expect(delta).toHaveTextContent(`${change} vs previous period`);
      expect(delta).toHaveAttribute('data-trend', trend);
    }
  );

  it('asks the channel for the range and shows no change for lifetime', async () => {
    const requests = serveAnalytics({ netSubscribers: 9, previous: null });
    const { container } = await renderCard('lifetime');

    expect(await screen.findByRole('figure')).toHaveTextContent('Net subscribers, lifetime+9');
    expect(container.querySelector('[data-slot="stat-card-delta"]')).not.toBeInTheDocument();
    expect(requests).toEqual([{ scope: 'channel', range: 'lifetime' }]);
  });

  it('keeps its label and offers a retry when the figures do not load', async () => {
    apiServer.use(mockEndpoint(getChannelAnalytics, () => problemReply(ErrorCodes.INTERNAL)));
    await renderCard();

    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
    expect(screen.getByText('Net subscribers, last 30 days')).toBeInTheDocument();
  });

  it('passes axe', async () => {
    serveAnalytics({ netSubscribers: 4, previous: { views: 0, netSubscribers: 1 } });
    await renderCard();
    await screen.findByRole('figure');

    expect(await axeViolations()).toEqual([]);
  });
});
