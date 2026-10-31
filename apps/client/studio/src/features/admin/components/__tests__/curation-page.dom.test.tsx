import { screen, within } from '@testing-library/react';
import { listAdminPicks } from '@vp/api-contracts';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { adminPick, renderCuration } from './picks.fixture';

describe('apps/client/studio: CurationPage', () => {
  it('shows the next 30 days with the scheduled picks on them', async () => {
    await renderCuration([adminPick()]);

    expect(screen.getByRole('heading', { name: 'Pick of the day' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'The next 30 days' })).getAllByRole('listitem')
    ).toHaveLength(30);
    expect(screen.getAllByRole('button', { name: /^Mountain lakes, / }).length).toBeGreaterThan(0);
  });

  it('says nothing is scheduled, and offers the first pick', async () => {
    const { user } = await renderCuration([]);

    expect(screen.getByText('Nothing is scheduled')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Schedule a pick' })[1] as HTMLElement);

    expect(await screen.findByRole('dialog', { name: 'Schedule a pick' })).toBeInTheDocument();
  });

  it('says the schedule did not load, and reads it again on retry', async () => {
    let failing = true;
    const { user } = await renderCuration([adminPick()], {
      handlers: [
        mockEndpoint(listAdminPicks, () =>
          failing ? problemReply('FORBIDDEN') : HttpResponse.json({ items: [adminPick()] })
        ),
      ],
    });

    expect(await screen.findByText('The schedule did not load.')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('list', { name: 'The next 30 days' })).toBeInTheDocument();
  });
});
