import { screen } from '@testing-library/react';
import { getWatchParty, joinWatchPartyAsGuest } from '@vp/api-contracts';
import {
  mockEndpoint,
  PARTY_ID,
  PARTY_VIEWER_KEY,
  partyMembership,
  partyPreview,
} from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderPartyRoute } from '#app/features/watch-party/__tests__/render-party-route';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/features/watch-party/__tests__/stub-party-player'))
    .StubPartyPlayer,
}));

const SEATED = {
  viewer: { memberKey: PARTY_VIEWER_KEY, canJoin: 'member', actions: [] },
} satisfies Parameters<typeof partyPreview>[0];

describe('apps/client/web: party page', () => {
  it('shows a visitor with no seat the room and the ways in, and no socket', async () => {
    const { socket } = await renderPartyRoute({ preview: { name: 'Movie night' } });

    expect(screen.getByRole('heading', { name: 'Movie night' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watch as guest' })).toBeInTheDocument();
    expect(socket.urls).toEqual([]);
  });

  it('puts a member in the room: the lobby, its roster and the socket opened with a ticket', async () => {
    const { socket } = await renderPartyRoute({ preview: SEATED });

    expect(await screen.findByText('Waiting to start', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Movie night' })).toBeInTheDocument();
    expect(socket.urls).toEqual([
      `ws://localhost:3000/v1/watch-parties/${PARTY_ID}/socket?ticket=ticket-1`,
    ]);
  });

  it('seats a guest in place: the preview is asked again and the room replaces it', async () => {
    let seated = false;
    const { user } = await renderPartyRoute({
      handlers: [
        mockEndpoint(joinWatchPartyAsGuest, () => {
          seated = true;
          return HttpResponse.json(
            {
              membership: partyMembership('guest:aGuestIdOfSixteenChars'),
              expiresAt: '2026-11-05T22:00:00.000Z',
            },
            { status: 201 }
          );
        }),
        mockEndpoint(getWatchParty, () =>
          HttpResponse.json(partyPreview(seated ? SEATED : { name: 'Movie night' }))
        ),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Watch as guest' }));

    expect(await screen.findByText('Waiting to start', { selector: 'p' })).toBeInTheDocument();
  });
});
