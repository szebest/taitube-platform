import { render, screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentProps } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { ExperimentResultCard, type ExperimentResultCardExperiment } from '../index';

const result = (variantId: 'a' | 'b', impressions: number, perImpression: number | null) => ({
  variantId,
  impressions,
  starts: 100,
  watchSeconds: 1000,
  watchSecondsPerImpression: perImpression,
  clickThrough: perImpression === null ? null : 0.125,
  averageViewSeconds: perImpression === null ? null : 150,
});

const experiment = (
  patch: Partial<ExperimentResultCardExperiment> = {}
): ExperimentResultCardExperiment => ({
  status: 'running',
  winnerVariantId: null,
  variants: [
    { id: 'a', title: 'Launch day', thumbnail: null },
    { id: 'b', title: 'We launched', thumbnail: { source: 'poster' } },
  ],
  results: { enoughData: false, variants: [result('a', 420, null), result('b', 380, null)] },
  ...patch,
});

const counted = {
  enoughData: true,
  variants: [result('a', 1200, 12.34), result('b', 1500, 9)],
};

function renderCard(
  patch: Partial<ExperimentResultCardExperiment> = {},
  variants: Partial<ComponentProps<typeof ExperimentResultCard.Variants>> = {}
) {
  render(
    <ExperimentResultCard.Root aria-label="Title test" experiment={experiment(patch)}>
      <ExperimentResultCard.Summary />
      <ExperimentResultCard.Variants {...variants} />
    </ExperimentResultCard.Root>,
    { wrapper: AppProviders }
  );
  const [, ...rows] = within(screen.getByRole('table')).getAllByRole('row');
  return { rows };
}

describe('apps/client/studio: ExperimentResultCard', () => {
  it('says there is not enough data yet and shows each variant on its way to 1000 impressions', () => {
    renderCard();

    expect(screen.getByText('Not enough data yet')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '420 of 1,000 impressions' })).toHaveAttribute(
      'aria-valuenow',
      '420'
    );
    expect(screen.getByRole('progressbar', { name: '380 of 1,000 impressions' })).toBeVisible();
  });

  it('withholds every ratio until there is enough data', () => {
    const { rows } = renderCard();

    expect(within(rows[0] as HTMLElement).getAllByText('Not yet')).toHaveLength(3);
  });

  it.each([
    { row: 0, text: 'Variant A, the control' },
    { row: 0, text: '12.3 sec' },
    { row: 0, text: '12.5%' },
    { row: 0, text: '2 min, 30 sec' },
    { row: 1, text: 'Poster thumbnail' },
    { row: 1, text: '1,500' },
  ])('shows "$text" on row $row once the numbers are in', ({ row, text }) => {
    const { rows } = renderCard({ results: counted });

    expect(rows[row]).toHaveTextContent(text);
  });

  it('leads with watch time per impression per variant', () => {
    renderCard({ results: counted });

    const [control] = screen.getAllByRole('figure');

    expect(control).toHaveTextContent('Variant A, the control');
    expect(control).toHaveTextContent('12.3 sec');
    expect(control).toHaveTextContent('Watch time per impression');
  });

  it.each([
    { status: 'finished' as const, winners: 2 },
    { status: 'running' as const, winners: 0 },
  ])('marks the applied winner of a $status test', ({ status, winners }) => {
    renderCard({ results: counted, status, winnerVariantId: 'b' });

    expect(screen.queryAllByText('Winner')).toHaveLength(winners);
  });

  it('draws the action of each row only when one is given', () => {
    const { rows } = renderCard({}, { action: (variant) => <button>Apply {variant.id}</button> });

    expect(within(rows[1] as HTMLElement).getByRole('button')).toHaveTextContent('Apply b');
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
  });

  it('draws no action column without an action', () => {
    renderCard();

    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
  });

  it('has no accessibility violations', async () => {
    renderCard({ results: counted, status: 'finished', winnerVariantId: 'a' });

    expect(await axeViolations()).toEqual([]);
  });
});
