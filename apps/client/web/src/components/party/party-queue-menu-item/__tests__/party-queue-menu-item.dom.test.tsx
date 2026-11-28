import { screen, waitFor } from '@testing-library/react';
import { addToWatchPartyQueue, getWatchParty, listMyWatchParties } from '@vp/api-contracts';
import { mockEndpoint, partyPreview, partyRoom, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderMenuCard } from './render-menu-card';

const inAParty = (permissions: string[]) => [
  mockEndpoint(listMyWatchParties, () =>
    HttpResponse.json({ owning: [], joined: [partyRoom()], interested: [] })
  ),
  mockEndpoint(getWatchParty, () =>
    HttpResponse.json(
      partyPreview({ viewer: { permissions: permissions as never, canJoin: 'member' } })
    )
  ),
];

describe('apps/client/web: PartyQueueMenuItem', () => {
  it('adds the video to the party queue the viewer may add to', async () => {
    const bodies: unknown[] = [];
    const { user, openMenu } = await renderMenuCard([
      ...inAParty(['queue.add']),
      mockEndpoint(addToWatchPartyQueue, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ items: [], version: 2 }, { status: 201 });
      }),
    ]);

    await openMenu();
    await user.click(await screen.findByRole('menuitem', { name: 'Add to party queue' }));

    await waitFor(() => expect(bodies).toEqual([{ videoId: VIDEO_ID }]));
    expect(await screen.findByText('Added to the party queue')).toBeInTheDocument();
  });

  it.each([
    { case: 'the viewer cannot add', handlers: inAParty([]) },
    {
      case: 'the viewer is in no party',
      handlers: [
        mockEndpoint(listMyWatchParties, () =>
          HttpResponse.json({ owning: [], joined: [], interested: [] })
        ),
      ],
    },
  ])('offers nothing when $case', async ({ handlers }) => {
    const { openMenu } = await renderMenuCard(handlers);

    await openMenu();
    await screen.findByRole('menuitem', { name: 'Watch together' });

    expect(screen.queryByRole('menuitem', { name: 'Add to party queue' })).toBeNull();
  });
});
