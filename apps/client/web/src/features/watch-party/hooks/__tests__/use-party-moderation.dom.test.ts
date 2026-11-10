import {
  assignWatchPartyRole,
  banWatchPartyMember,
  kickWatchPartyMember,
  revokeWatchPartyRole,
  transferWatchPartyOwnership,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, PARTY_ID, PARTY_OWNER_KEY, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { usePartyModeration } from '../use-party-moderation';

const ROLE_ID = '0190c3a0-5e1d-7000-8000-000000009301';

describe('apps/client/web: usePartyModeration', () => {
  it.each([
    {
      label: 'kicks',
      action: { type: 'kick', memberKey: PARTY_OWNER_KEY },
      endpoint: kickWatchPartyMember,
      asked: { params: { id: PARTY_ID, memberKey: PARTY_OWNER_KEY }, body: '' },
    },
    {
      label: 'bans',
      action: { type: 'ban', memberKey: PARTY_OWNER_KEY },
      endpoint: banWatchPartyMember,
      asked: { params: { id: PARTY_ID, memberKey: PARTY_OWNER_KEY }, body: '' },
    },
    {
      label: 'assigns a role with its expiry',
      action: { type: 'assign', memberKey: PARTY_OWNER_KEY, roleId: ROLE_ID, expiresIn: '10m' },
      endpoint: assignWatchPartyRole,
      asked: {
        params: { id: PARTY_ID, memberKey: PARTY_OWNER_KEY, roleId: ROLE_ID },
        body: '{"expiresIn":"10m"}',
      },
    },
    {
      label: 'revokes a role',
      action: { type: 'revoke', memberKey: PARTY_OWNER_KEY, roleId: ROLE_ID },
      endpoint: revokeWatchPartyRole,
      asked: { params: { id: PARTY_ID, memberKey: PARTY_OWNER_KEY, roleId: ROLE_ID }, body: '' },
    },
  ] as const)('$label', async ({ action, endpoint, asked: expected }) => {
    const asked: unknown[] = [];
    apiServer.use(
      mockEndpoint(endpoint, async ({ params, request }) => {
        asked.push({ params, body: await request.text() });
        return new HttpResponse(null, { status: 204 });
      })
    );

    await runMutation(
      createQueryClient(),
      () => usePartyModeration(PARTY_ID),
      action,
      AppProviders
    );

    expect(asked).toEqual([expected]);
  });

  it('transfers ownership to the member', async () => {
    const asked: unknown[] = [];
    apiServer.use(
      mockEndpoint(transferWatchPartyOwnership, async ({ params, request }) => {
        asked.push({ params, body: await request.text() });
        return HttpResponse.json({ ownerKey: PARTY_OWNER_KEY, rolesVersion: 2 });
      })
    );

    await runMutation(
      createQueryClient(),
      () => usePartyModeration(PARTY_ID),
      { type: 'transfer', memberKey: PARTY_OWNER_KEY },
      AppProviders
    );

    expect(asked).toEqual([
      { params: { id: PARTY_ID }, body: `{"memberKey":"${PARTY_OWNER_KEY}"}` },
    ]);
  });

  it('rejects when the API refuses the moderation', async () => {
    apiServer.use(
      mockEndpoint(kickWatchPartyMember, () => problemReply(ErrorCodes.WATCH_PARTY_ROLE_ESCALATION))
    );

    const settled = await runMutation(
      createQueryClient(),
      () => usePartyModeration(PARTY_ID),
      { type: 'kick', memberKey: PARTY_OWNER_KEY },
      AppProviders
    );

    expect(settled.status).toBe('rejected');
  });
});
