import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { PersonalControlView } from '@vp/api-contracts';
import type { WatchPartyViewer } from '@vp/permissions';
import type { PartyRequest, WatchPartyState } from '@vp/queries';
import { PARTY_ID, PARTY_OWNER_KEY } from '@vp/web-testing';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { partyViewer, renderParty } from '#app/features/watch-party/__tests__/render-party';
import { PartyControls } from '../party-controls';

const DJ = partyViewer(['playback.control']);
const ASKER = partyViewer(['playback.request']);
const LISTENER = partyViewer(['chat.post']);

const PLAYING = {
  itemId: '0190c3a0-5e1d-7000-8000-000000009201',
  phase: 'playing',
  positionMs: 10_000,
  rate: 1,
  anchorAt: 1_000,
} as const;

function renderControls(
  viewer: WatchPartyViewer,
  state: Partial<WatchPartyState> = {},
  controls: PersonalControlView[] = []
) {
  const send = vi.fn(() => true);
  const dismissRequest = vi.fn();
  renderParty(
    <PartyControls
      roomId={PARTY_ID}
      socket={{
        state: partyState({ version: 4, rolesVersion: 2, ...state }),
        serverNow: () => 6_000,
        send,
        dismissRequest,
      }}
    />,
    viewer,
    controls
  );

  return { send, dismissRequest };
}

const REQUEST = (kind: PartyRequest['kind'], positionMs?: number): PartyRequest => ({
  key: `${PARTY_OWNER_KEY}:${kind}:0:`,
  from: PARTY_OWNER_KEY,
  kind,
  positionMs,
});

describe('apps/client/web: PartyControls', () => {
  it('pauses a playing room at the room position, with the versions it saw', async () => {
    const { send } = renderControls(DJ, { playback: PLAYING });

    await userEvent.click(screen.getByRole('button', { name: 'Paused' }));

    expect(send).toHaveBeenCalledWith({
      type: 'pause',
      positionMs: 15_000,
      version: 4,
      rolesVersion: 2,
    });
  });

  it('plays a paused room', async () => {
    const { send } = renderControls(DJ, { playback: { ...PLAYING, phase: 'paused' } });

    await userEvent.click(screen.getByRole('button', { name: 'Now playing' }));

    expect(send).toHaveBeenCalledWith({ type: 'play', version: 4, rolesVersion: 2 });
  });

  it('says a viewer cannot control playback and lets one who may request, ask', async () => {
    const { send } = renderControls(ASKER, { playback: PLAYING });

    await userEvent.click(screen.getByRole('button', { name: 'Request' }));

    expect(screen.getByText("You can't control playback in this party")).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith({ type: 'request', kind: 'skip' });
  });

  it('asks to start in the lobby', async () => {
    const { send } = renderControls(ASKER);

    await userEvent.click(screen.getByRole('button', { name: 'Request' }));

    expect(send).toHaveBeenCalledWith({ type: 'request', kind: 'start' });
  });

  it('offers a viewer who may neither control nor request no button', () => {
    renderControls(LISTENER, { playback: PLAYING });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    {
      request: REQUEST('seek', 90_000),
      text: 'Ana asks to jump to 90s',
      frame: { type: 'seek', positionMs: 90_000, version: 4, rolesVersion: 2 },
    },
    {
      request: REQUEST('skip'),
      text: 'Ana asks to skip',
      frame: { type: 'next', version: 4, rolesVersion: 2 },
    },
    {
      request: REQUEST('start'),
      text: 'Ana asks to start',
      frame: { type: 'start', version: 4, rolesVersion: 2 },
    },
  ] satisfies { request: PartyRequest; text: string; frame: unknown }[])(
    'shows "$text" to a controller and runs it on Accept',
    async ({ request, text, frame }) => {
      const { send, dismissRequest } = renderControls(DJ, {
        playback: PLAYING,
        requests: [request],
      });

      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

      expect(screen.getByText(text)).toBeInTheDocument();
      expect(send).toHaveBeenCalledWith(frame);
      expect(dismissRequest).toHaveBeenCalledWith(request.key);
    }
  );

  it('dismisses a request without running it', async () => {
    const request = REQUEST('skip');
    const { send, dismissRequest } = renderControls(DJ, { playback: PLAYING, requests: [request] });

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(dismissRequest).toHaveBeenCalledWith(request.key);
    expect(send).not.toHaveBeenCalled();
  });

  it('leaves out the requests of a member whose requests the viewer hid', async () => {
    renderControls(DJ, { requests: [REQUEST('skip')] }, [
      {
        targetKey: PARTY_OWNER_KEY,
        roomId: PARTY_ID,
        voiceMuted: false,
        volume: 100,
        hideMessages: false,
        hideReactions: false,
        hideAvatar: false,
        hideRequests: true,
        blockInvites: false,
        favourite: false,
      },
    ]);

    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
    );
  });
});
