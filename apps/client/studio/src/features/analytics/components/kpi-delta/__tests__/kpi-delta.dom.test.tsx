import { render } from '@testing-library/react';
import { AppProviders } from '#app/__tests__/providers';
import { StatCard } from '#app/components/analytics/stat-card';
import type { KpiDeltaProps } from '../kpi-delta';
import { KpiDelta } from '../kpi-delta';

const renderDelta = (change: KpiDeltaProps['change']) =>
  render(
    <AppProviders>
      <StatCard.Root>
        <KpiDelta change={change} />
      </StatCard.Root>
    </AppProviders>
  );

describe('apps/client/studio: KpiDelta', () => {
  it('says the formatted change against the previous period, its arrow following the trend', () => {
    const { container } = renderDelta({
      trend: 'down',
      value: { type: 'percent', value: -12.5, options: { signDisplay: 'exceptZero' } },
    });

    const delta = container.querySelector('[data-slot="stat-card-delta"]');

    expect(delta).toHaveTextContent('-12.5% vs previous period');
    expect(delta).toHaveAttribute('data-trend', 'down');
  });

  it('shows nothing without a change', () => {
    const { container } = renderDelta(null);

    expect(container.querySelector('[data-slot="stat-card-delta"]')).not.toBeInTheDocument();
  });
});
