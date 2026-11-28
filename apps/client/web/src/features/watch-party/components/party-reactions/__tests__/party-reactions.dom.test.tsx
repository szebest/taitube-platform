import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { PersonalControlView } from '@vp/api-contracts';
import type { WatchPartySocket } from '@vp/queries';
import { PARTY_ID, PARTY_OWNER_KEY } from '@vp/web-testing';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { partyViewer, renderParty } from '#app/features/watch-party/__tests__/render-party';
import { PartyReactionBar, PartyReactionOverlay } from '../party-reactions';

const REACTIONS = [
  { id: 1, memberKey: PARTY_OWNER_KEY, emoji: '🔥', count: 2 },
  { id: 2, memberKey: 'user:other', emoji: '🎉', count: 1 },
] as const;

function socketOf(send = vi.fn(() => true)): WatchPartySocket {
  return {
    state: partyState({ reactions: [...REACTIONS] }),
    serverNow: () => 0,
    send,
    dismissRequest: () => undefined,
  };
}

const HIDDEN: PersonalControlView = {
  targetKey: PARTY_OWNER_KEY,
  roomId: PARTY_ID,
  voiceMuted: false,
  volume: 100,
  hideMessages: false,
  hideReactions: true,
  hideAvatar: false,
  hideRequests: false,
  blockInvites: false,
  favourite: false,
};

function bursts(container: HTMLElement) {
  return [...container.querySelectorAll('[data-slot="reaction-overlay-burst"]')].map(
    (burst) => burst.textContent
  );
}

describe('apps/client/web: PartyReactions', () => {
  it('rises each member reaction the viewer has not hidden', async () => {
    const { container } = renderParty(
      <PartyReactionOverlay roomId={PARTY_ID} socket={socketOf()} />,
      partyViewer([]),
      [HIDDEN]
    );

    await vi.waitFor(() => expect(bursts(container)).toEqual(['🎉']));
  });

  it('sends a react frame for the emoji picked', async () => {
    const send = vi.fn(() => true);
    renderParty(<PartyReactionBar socket={socketOf(send)} />, partyViewer(['chat.react']));

    await userEvent.click(screen.getByRole('button', { name: 'React with 🔥' }));

    expect(send).toHaveBeenCalledWith({ type: 'react', emoji: '🔥' });
  });
});
