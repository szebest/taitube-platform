import { screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { renderLive } from '../../__tests__/render-live';
import { LiveViewersChart } from '../live-viewers-chart';

const AT = Date.parse('2026-11-05T10:00:00.000Z');

const samplesOf = (viewers: readonly number[]) =>
  viewers.map((count, index) => ({ at: AT + index * 15_000, viewers: count }));

describe('apps/client/studio: LiveViewersChart', () => {
  it.each([
    { heard: [], scenario: 'nothing heard' },
    { heard: [4], scenario: 'one count' },
  ])('is empty with $scenario: a line needs two points', ({ heard }) => {
    renderLive(<LiveViewersChart samples={samplesOf(heard)} />);

    expect(screen.getByText('Viewers while live').closest('figure')).toHaveTextContent(
      'No data yet'
    );
  });

  it('writes the counts as a table for assistive technology', () => {
    renderLive(<LiveViewersChart samples={samplesOf([4, 1200, 7])} />);

    const rows = within(screen.getByRole('table', { hidden: true })).getAllByRole('row', {
      hidden: true,
    });

    expect(rows.map((row) => row.lastElementChild?.textContent)).toEqual([
      'Viewers',
      '4',
      '1,200',
      '7',
    ]);
  });

  it('passes axe', async () => {
    renderLive(<LiveViewersChart samples={samplesOf([4, 5])} />);

    expect(await axeViolations()).toEqual([]);
  });
});
