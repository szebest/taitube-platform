import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { updateWatchParty } from '@vp/api-contracts';
import type { WatchPartyViewer } from '@vp/permissions';
import { apiServer, mockEndpoint, PARTY_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { partyViewer, renderParty } from '#app/features/watch-party/__tests__/render-party';
import { PartyAccentMenu } from '../party-accent-menu';

const STATE = partyState();
const { room: ROOM } = STATE;
if (!ROOM) {
  throw new Error('a hello state carries its room');
}

function renderMenu(viewer: WatchPartyViewer) {
  renderParty(
    <PartyAccentMenu
      roomId={PARTY_ID}
      socket={{
        state: STATE,
        serverNow: () => 0,
        send: () => true,
        dismissRequest: () => undefined,
      }}
    />,
    viewer
  );
}

describe('apps/client/web: PartyAccentMenu', () => {
  it('saves the picked colour against the room version it read', async () => {
    const saved: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateWatchParty, async ({ request }) => {
        saved.push(await request.json());
        return HttpResponse.json({ ...ROOM, accent: '#30a46c' });
      })
    );
    renderMenu(partyViewer(['room.edit']));

    await userEvent.click(screen.getByRole('button', { name: 'Room accent' }));
    await userEvent.click(screen.getByRole('radio', { name: '#30a46c' }));

    await vi.waitFor(() => expect(saved).toEqual([{ version: ROOM.version, accent: '#30a46c' }]));
  });

  it('offers nothing without room.edit', () => {
    renderMenu(partyViewer(['chat.post']));

    expect(screen.queryByRole('button', { name: 'Room accent' })).not.toBeInTheDocument();
  });
});
