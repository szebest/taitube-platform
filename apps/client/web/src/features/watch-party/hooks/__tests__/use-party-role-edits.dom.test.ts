import {
  applyWatchPartyPreset,
  createWatchPartyRole,
  deleteWatchPartyRole,
  updateWatchPartyRole,
  type WatchPartyRoleView,
} from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, PARTY_ID } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { type PartyRoleEdit, usePartyRoleEdits } from '../use-party-role-edits';

const ROLE_ID = '0190c3a0-5e1d-7000-8000-000000009302';
const UPDATED_AT = '2026-11-28T10:00:00.000Z';

const ROLE: WatchPartyRoleView = {
  id: ROLE_ID,
  key: null,
  kind: 'grant',
  name: 'Queue keeper',
  colour: null,
  position: 20,
  permissions: ['queue.add'],
  memberCount: 0,
  updatedAt: UPDATED_AT,
};

function edit(change: PartyRoleEdit) {
  return runMutation(createQueryClient(), () => usePartyRoleEdits(PARTY_ID), change, AppProviders);
}

describe('apps/client/web: usePartyRoleEdits', () => {
  it('creates a grant role with its permissions', async () => {
    const asked: unknown[] = [];
    apiServer.use(
      mockEndpoint(createWatchPartyRole, async ({ params, request }) => {
        asked.push({ params, body: await request.json() });
        return HttpResponse.json(ROLE, { status: 201 });
      })
    );

    await edit({ type: 'create', name: 'Queue keeper', permissions: ['queue.add'] });

    expect(asked).toEqual([
      {
        params: { id: PARTY_ID },
        body: { name: 'Queue keeper', kind: 'grant', permissions: ['queue.add'] },
      },
    ]);
  });

  it('saves a role guarded by its updatedAt', async () => {
    const asked: unknown[] = [];
    apiServer.use(
      mockEndpoint(updateWatchPartyRole, async ({ params, request }) => {
        asked.push({ params, body: await request.json() });
        return HttpResponse.json(ROLE);
      })
    );

    await edit({
      type: 'update',
      roleId: ROLE_ID,
      updatedAt: UPDATED_AT,
      permissions: ['queue.add'],
    });

    expect(asked).toEqual([
      {
        params: { id: PARTY_ID, roleId: ROLE_ID },
        body: { permissions: ['queue.add'], updatedAt: UPDATED_AT },
      },
    ]);
  });

  it('deletes a role', async () => {
    const asked: unknown[] = [];
    apiServer.use(
      mockEndpoint(deleteWatchPartyRole, ({ params }) => {
        asked.push(params);
        return new HttpResponse(null, { status: 204 });
      })
    );

    await edit({ type: 'delete', roleId: ROLE_ID });

    expect(asked).toEqual([{ id: PARTY_ID, roleId: ROLE_ID }]);
  });

  it('applies a preset', async () => {
    const asked: unknown[] = [];
    apiServer.use(
      mockEndpoint(applyWatchPartyPreset, async ({ params, request }) => {
        asked.push({ params, body: await request.json() });
        return HttpResponse.json({ items: [ROLE], rolesVersion: 2, permissionsVersion: 1 });
      })
    );

    await edit({ type: 'preset', preset: 'public' });

    expect(asked).toEqual([{ params: { id: PARTY_ID }, body: { preset: 'public' } }]);
  });
});
