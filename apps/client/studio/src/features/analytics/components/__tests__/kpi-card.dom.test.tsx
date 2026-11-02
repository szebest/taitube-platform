import { screen } from '@testing-library/react';
import { getChannelAnalytics } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';
import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { renderAnalytics } from '#app/features/analytics/__tests__/render-analytics';
import type { AnalyticsRange, KpiMetric } from '#app/features/analytics/types';
import { KpiCard } from '../kpi-card';

const renderCard = (metric: KpiMetric, range: AnalyticsRange = '30d') =>
  renderAnalytics(<KpiCard metric={metric} range={range} scope={{ kind: 'channel' }} />);

describe('apps/client/studio: KpiCard', () => {
  it.each([
    { metric: 'views', label: 'Views, last 30 days', value: '40' },
    { metric: 'watch-time', label: 'Watch time, last 30 days', value: '1 hr' },
    {
      metric: 'average-view-duration',
      label: 'Average view duration, last 30 days',
      value: '1 min, 30 sec',
    },
  ] as const)('shows $metric as $value under its label', async ({ metric, label, value }) => {
    serveAnalytics({ views: [10, 0, 30] });
    await renderCard(metric);

    const figure = await screen.findByRole('figure');

    expect(figure).toHaveTextContent(label);
    expect(figure).toHaveTextContent(value);
  });

  it.each([
    { metric: 'views', previous: { views: 20, netSubscribers: 0 }, change: '+100%', trend: 'up' },
    {
      metric: 'average-view-duration',
      previous: { views: 20, netSubscribers: 0 },
      change: '0%',
      trend: 'flat',
    },
    {
      metric: 'watch-time',
      previous: { views: 80, netSubscribers: 0 },
      change: '-50%',
      trend: 'down',
    },
  ] as const)(
    'shows the $metric change against the previous period',
    async ({ metric, previous, change, trend }) => {
      serveAnalytics({ views: [10, 0, 30], previous });
      const { container } = await renderCard(metric);

      await screen.findByRole('figure');
      const delta = container.querySelector('[data-slot="stat-card-delta"]');

      expect(delta).toHaveTextContent(`${change} vs previous period`);
      expect(delta).toHaveAttribute('data-trend', trend);
    }
  );

  it('shows no change without a previous period, as for lifetime', async () => {
    serveAnalytics({ previous: null });
    const { container } = await renderCard('views', 'lifetime');

    expect(await screen.findByText('Views, lifetime')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="stat-card-delta"]')).not.toBeInTheDocument();
  });

  it('names the range it was asked for', async () => {
    const requests = serveAnalytics();
    await renderCard('views', '7d');

    expect(await screen.findByText('Views, last 7 days')).toBeInTheDocument();
    expect(requests).toEqual([{ scope: 'channel', range: '7d' }]);
  });

  it('draws the daily series as the sparkline, out of the accessibility tree', async () => {
    serveAnalytics({ views: [1, 2, 3] });
    const { container } = await renderCard('views');

    await screen.findByRole('figure');

    expect(container.querySelector('[data-slot="stat-card-spark"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  it('holds the card at its height while the numbers load', async () => {
    serveAnalytics();
    const { container } = await renderCard('views');

    expect(container.querySelector('[data-slot="stat-card-skeleton"]')).toBeInTheDocument();
    await screen.findByRole('figure');
  });

  it('says there is no data yet when nothing was watched', async () => {
    serveAnalytics({ views: [0, 0] });
    await renderCard('views');

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
  });

  it('keeps its label and offers a retry when the numbers do not load', async () => {
    apiServer.use(mockEndpoint(getChannelAnalytics, () => problemReply(ErrorCodes.INTERNAL)));
    await renderCard('views');

    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
    expect(screen.getByText('Views, last 30 days')).toBeInTheDocument();
  });

  it('passes axe', async () => {
    serveAnalytics();
    await renderCard('views');
    await screen.findByRole('figure');

    expect(await axeViolations()).toEqual([]);
  });
});
