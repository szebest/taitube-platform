import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { updateWatchPartyRole, type WatchPartyRoleView } from '@vp/api-contracts';
import type { WatchPartyViewer } from '@vp/permissions';
import { apiServer, mockEndpoint, PARTY_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { partyViewer, renderParty } from '#app/features/watch-party/__tests__/render-party';
import { PartyRoleEditor } from '../party-role-editor';

const ROLE_ID = '0190c3a0-5e1d-7000-8000-000000009601';

const CUSTOM: WatchPartyRoleView = {
  id: ROLE_ID,
  key: null,
  kind: 'grant',
  name: 'Queue keeper',
  colour: '#3366ff',
  position: 20,
  permissions: ['chat.post'],
  memberCount: 0,
  updatedAt: '2026-11-28T10:00:00.000Z',
};

function renderRoleEditor(viewer: WatchPartyViewer) {
  renderParty(
    <PartyRoleEditor
      roomId={PARTY_ID}
      socket={{
        state: partyState({ roles: [CUSTOM] }),
        serverNow: () => 0,
        send: () => true,
        dismissRequest: () => undefined,
      }}
    />,
    viewer
  );
}

describe('apps/client/web: PartyRoleEditor', () => {
  it("saves queue.add into a role guarded by the role's updatedAt", async () => {
    const saved: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateWatchPartyRole, async ({ params, request }) => {
        saved.push({ roleId: params.roleId, body: await request.json() });
        return HttpResponse.json({ ...CUSTOM, permissions: ['chat.post', 'queue.add'] });
      })
    );
    renderRoleEditor(partyViewer(['roles.manage', 'queue.add'], { topPosition: 600 }));

    await userEvent.click(screen.getByRole('button', { name: 'Roles' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Add to the queue/ }));

    await vi.waitFor(() =>
      expect(saved).toEqual([
        {
          roleId: ROLE_ID,
          body: { permissions: ['chat.post', 'queue.add'], updatedAt: CUSTOM.updatedAt },
        },
      ])
    );
  });

  it('offers no editor to a viewer without roles.manage', () => {
    renderRoleEditor(partyViewer(['queue.add']));

    expect(screen.queryByRole('button', { name: 'Roles' })).not.toBeInTheDocument();
  });
});
