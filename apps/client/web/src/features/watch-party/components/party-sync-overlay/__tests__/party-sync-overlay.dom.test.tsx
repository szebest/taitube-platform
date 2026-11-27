import { render, screen } from '@testing-library/react';
import type { WatchPartySocket } from '@vp/queries';
import { AppProviders } from '#app/__tests__/providers';
import { resetFakePlayer } from '#app/features/watch-party/__tests__/fake-player';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { PartySyncOverlay } from '../party-sync-overlay';

vi.mock(import('#app/integrations/video-js/video-js-engine'), async () =>
  (await import('#app/features/watch-party/__tests__/fake-player')).fakeEngine()
);

function renderOverlay(socket: Partial<WatchPartySocket> = {}) {
  render(
    <AppProviders>
      <PartySyncOverlay
        socket={{
          state: partyState(),
          serverNow: () => 0,
          send: () => true,
          dismissRequest: () => undefined,
          ...socket,
        }}
      />
    </AppProviders>
  );
}

describe('apps/client/web: PartySyncOverlay', () => {
  beforeEach(() => {
    resetFakePlayer();
  });

  it('says the player is in sync with the room', () => {
    renderOverlay();

    expect(screen.getByRole('status')).toHaveTextContent('In sync');
  });

  it('says it is reconnecting while the socket is down', () => {
    renderOverlay({ state: partyState({ connection: 'closed' }) });

    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting');
  });
});
