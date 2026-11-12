import { act, screen } from '@testing-library/react';
import { upgradeWatchPartySeat } from '@vp/api-contracts';
import type { partyPreview } from '@vp/web-testing';
import {
  account,
  mockEndpoint,
  PARTY_VIEWER_KEY,
  partyHello,
  partyMembership,
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

const GUEST_HELLO = partyHello({
  you: { memberKey: 'guest:aGuestIdOfSixteenChars', kind: 'guest', roleIds: [] },
});

describe('apps/client/web: PartyRoomView', () => {
  it('names the room, its host, its phase and how many are here', async () => {
    await renderPartyRoute({ preview: SEATED });

    expect(await screen.findByText('2 here')).toBeInTheDocument();
    expect(screen.getByText('Hosted by Ana')).toBeInTheDocument();
    expect(screen.getByText('Waiting to start', { selector: 'span' })).toBeInTheDocument();
  });

  it('moves the panel with the layout the viewer picks', async () => {
    const { user, container } = await renderPartyRoute({ preview: SEATED });

    await user.click(await screen.findByRole('button', { name: 'Layout' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Focus' }));

    expect(container.querySelector('[data-slot="party-room"]')).toHaveAttribute(
      'data-layout',
      'focus'
    );
  });

  it.each([
    { frame: { type: 'kicked' }, shown: 'You were removed from this party' },
    { frame: { type: 'superseded' }, shown: 'You joined this party in another tab' },
    { frame: { type: 'closed', reason: 'owner' }, shown: 'This party ended' },
  ] as const)(
    'says "$shown" when the room ends the visit with $frame',
    async ({ frame, shown }) => {
      const { socket } = await renderPartyRoute({ preview: SEATED });
      await vi.waitFor(() => expect(socket.urls).toHaveLength(1));

      act(() => socket.push(frame));

      expect(await screen.findByText(shown)).toBeInTheDocument();
    }
  );

  it('sends a guest who is not signed in to log in from the chat bar', async () => {
    const { user, router } = await renderPartyRoute({ preview: SEATED, frames: [GUEST_HELLO] });

    await user.click(await screen.findByRole('button', { name: 'Sign in to chat' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('upgrades the seat of a guest who is signed in, in place', async () => {
    const upgraded = vi.fn();
    const { user } = await renderPartyRoute({
      preview: SEATED,
      frames: [GUEST_HELLO],
      viewer: account(),
      handlers: [
        mockEndpoint(upgradeWatchPartySeat, () => {
          upgraded();
          return HttpResponse.json({ membership: partyMembership() });
        }),
      ],
    });

    await user.click(await screen.findByRole('button', { name: 'Sign in to chat' }));

    await vi.waitFor(() => expect(upgraded).toHaveBeenCalledOnce());
  });
});
