import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { getVideo } from '@vp/api-contracts';
import type { WatchPartyState } from '@vp/queries';
import { apiServer, mockEndpoint, PARTY_OWNER_KEY, PARTY_VIEWER_KEY, video } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { partyViewer, renderParty } from '#app/features/watch-party/__tests__/render-party';
import { PartyStage } from '../party-stage';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/features/watch-party/__tests__/stub-party-player'))
    .StubPartyPlayer,
}));

const PLAYBACK_URL = 'http://localhost:9000/public/videos/v1/hls/master.m3u8';

const HOST = partyViewer(['playback.control'], { topPosition: 100, isOwner: true });

const PLAYING = {
  itemId: '0190c3a0-5e1d-7000-8000-000000009201',
  phase: 'playing',
  positionMs: 10_000,
  rate: 1,
  anchorAt: 1_000,
} as const;

function renderStage(state: Partial<WatchPartyState> = {}) {
  const send = vi.fn(() => true);
  apiServer.use(
    mockEndpoint(getVideo, () => HttpResponse.json(video({ playbackUrl: PLAYBACK_URL })))
  );
  renderParty(
    <PartyStage
      socket={{
        state: partyState({ version: 4, rolesVersion: 2, ...state }),
        serverNow: () => 6_000,
        send,
        dismissRequest: () => undefined,
      }}
    />,
    HOST
  );

  return { send };
}

describe('apps/client/web: PartyStage', () => {
  it('waits in the lobby with who is ready, and starts for a viewer who controls playback', async () => {
    const { send } = renderStage();

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByText('Waiting to start')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 ready')).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith({ type: 'start', version: 4, rolesVersion: 2 });
  });

  it('toggles the viewer ready mark', async () => {
    const { send } = renderStage();

    await userEvent.click(screen.getByRole('button', { name: "I'm ready" }));

    expect(send).toHaveBeenCalledWith({ type: 'ready', ready: true });
  });

  it('shows the countdown in the lobby while the start is counted down', async () => {
    renderStage({ playback: PLAYING, countdownEndsAt: 8_500 });

    expect(await screen.findByText('Starting in 3')).toBeInTheDocument();
  });

  it('plays the room video with no controls of its own once the party started', async () => {
    renderStage({ playback: PLAYING });

    const player = await screen.findByTestId('player');

    expect(player).toHaveAttribute('data-controls', 'false');
    expect(player).toHaveAttribute('data-src', PLAYBACK_URL);
  });

  it('says the queue is finished', () => {
    renderStage({ playback: { ...PLAYING, phase: 'finished' } });

    expect(screen.getByText('The queue is finished')).toBeInTheDocument();
  });

  it('marks the viewer ready from the roster entry that is theirs', () => {
    renderStage({
      roster: partyState().roster.map((person) =>
        person.memberKey === PARTY_VIEWER_KEY ? { ...person, ready: true } : person
      ),
    });

    expect(screen.getByRole('button', { name: 'Not ready' })).toBeInTheDocument();
    expect(PARTY_OWNER_KEY).not.toBe(PARTY_VIEWER_KEY);
  });
});
