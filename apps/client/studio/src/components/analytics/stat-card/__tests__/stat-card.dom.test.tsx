import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { variantNames } from '@vp/ui';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { STAT_CARD_TREND_TONE, StatCard, StatCardSkeleton, statCardStyles } from '..';
import type { StatCardRootProps } from '../stat-card';
import type { StatCardTrend } from '../types';

const renderCard = (props: StatCardRootProps = {}, trend: StatCardTrend = 'up') =>
  render(
    <AppProviders>
      <StatCard.Root {...props}>
        <StatCard.Label>Views, last 28 days</StatCard.Label>
        <StatCard.Value>1.24M</StatCard.Value>
        <StatCard.Delta trend={trend}>+8.4% vs previous 28 days</StatCard.Delta>
        <StatCard.Spark values={[12, 14, 20]} series={2} />
      </StatCard.Root>
    </AppProviders>
  );

describe('apps/client/studio: StatCard', () => {
  it('captions the figure with its label and reads the value and delta after it', () => {
    renderCard();

    const figure = screen.getByRole('figure');

    expect(figure.firstElementChild).toEqual(
      screen.getByText('Views, last 28 days', { selector: 'figcaption' })
    );
    expect(figure).toHaveTextContent('Views, last 28 days1.24M+8.4% vs previous 28 days');
  });

  it.each(variantNames(STAT_CARD_TREND_TONE))('marks a %s delta with its arrow', (trend) => {
    const { container } = renderCard({}, trend);

    expect(container.querySelector('[data-slot="stat-card-delta"]')).toHaveAttribute(
      'data-trend',
      trend
    );
  });

  it('draws the sparkline in its series colour, out of the accessibility tree', () => {
    const { container } = renderCard();

    const spark = container.querySelector('[data-slot="stat-card-spark"]');

    expect(spark).toHaveAttribute('aria-hidden', 'true');
    expect(spark?.querySelector('polyline')).toHaveAttribute('points', '0,32 50,24 100,0');
    expect(spark?.querySelector('polyline')).toHaveStyle({
      stroke: 'var(--dataviz-categorical-3)',
    });
  });

  it('shows the no-data line and drops the delta and sparkline when empty', () => {
    const { container } = renderCard({ state: 'empty' });

    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.queryByText('1.24M')).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="stat-card-delta"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="stat-card-spark"]')).not.toBeInTheDocument();
  });

  it('keeps the label and replaces the value with a retry bar on error', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderCard({ state: 'error', onRetry });

    expect(screen.getByText('Views, last 28 days')).toBeInTheDocument();
    expect(screen.getByText('Could not load this')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it.each(variantNames(statCardStyles.variants.size))(
    'holds the %s card and its skeleton to one height',
    (size) => {
      const { container } = renderCard({ size });
      renderCard({ size, state: 'loading' });

      const card = container.querySelector('[data-slot="stat-card"]');
      const skeleton = document.querySelector('[data-slot="stat-card-skeleton"]');
      const heightOf = (element: Element | null) =>
        [...(element?.classList ?? [])].find((name) => name.startsWith('tw:min-h-'));

      expect(heightOf(card)).toMatch(/^tw:min-h-/);
      expect(heightOf(skeleton)).toBe(heightOf(card));
    }
  );

  it('becomes the link it is given, with a chevron, keeping the figure inside', () => {
    render(
      <AppProviders>
        <StatCard.Root asChild>
          <a href="/analytics/views">
            <StatCard.Label>Views, last 28 days</StatCard.Label>
            <StatCard.Value>1.24M</StatCard.Value>
          </a>
        </StatCard.Root>
      </AppProviders>
    );

    const link = screen.getByRole('link', { name: /Views, last 28 days/ });

    expect(link).toHaveAttribute('data-slot', 'stat-card');
    expect(within(link).getByRole('figure')).toHaveTextContent('1.24M');
    expect(link.querySelector('[data-icon="chevron-right"]')).toBeInTheDocument();
  });

  it('passes axe, loaded, empty, failed and as a skeleton', async () => {
    renderCard();
    renderCard({ state: 'empty' });
    renderCard({ state: 'error', onRetry: vi.fn() });
    render(<StatCardSkeleton size="lg" />);

    expect(await axeViolations()).toEqual([]);
  });
});
