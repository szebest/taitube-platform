import { joinWatchParty } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient, watchPartyKeys } from '@vp/queries';
import { apiServer, mockEndpoint, PARTY_ID, partyMembership, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { useJoinParty } from '../use-join-party';

describe('apps/client/web: useJoinParty', () => {
  it('joins with the password and the invite, and marks every party query stale', async () => {
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
      () => useJoinParty(PARTY_ID),
      { password: 'hunter2', invite: 'inv-1' },
      AppProviders
    );

    expect(bodies).toEqual([{ password: 'hunter2', invite: 'inv-1' }]);
    expect(client.getQueryState(watchPartyKeys.preview(PARTY_ID))?.isInvalidated).toBe(true);
  });

  it('rejects with the API refusal', async () => {
    apiServer.use(
      mockEndpoint(joinWatchParty, () => problemReply(ErrorCodes.WATCH_PARTY_PASSWORD_INVALID))
    );

    const settled = await runMutation(
      createQueryClient(),
      () => useJoinParty(PARTY_ID),
      { password: 'nope' },
      AppProviders
    );

    expect(settled.status).toBe('rejected');
  });
});
