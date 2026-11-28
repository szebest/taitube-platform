import { joinWatchParty } from '@vp/api-contracts';
import { createQueryClient, watchPartyKeys } from '@vp/queries';
import { apiServer, mockEndpoint, PARTY_ID, partyMembership } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { useJoinPartyInvite } from '../use-join-party-invite';

describe('apps/client/web: useJoinPartyInvite', () => {
  it('joins on the invite alone and marks every party query stale', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(joinWatchParty, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ membership: partyMembership() });
      })
    );
    const client = createQueryClient();
    client.setQueryData(watchPartyKeys.preview(PARTY_ID), {});

    await runMutation(
      client,
      useJoinPartyInvite,
      { roomId: PARTY_ID, inviteId: 'inv-1' },
      AppProviders
    );

    expect(bodies).toEqual([{ invite: 'inv-1' }]);
    expect(client.getQueryState(watchPartyKeys.preview(PARTY_ID))?.isInvalidated).toBe(true);
  });
});
