import { joinWatchPartyAsGuest } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient, watchPartyKeys } from '@vp/queries';
import { apiServer, mockEndpoint, PARTY_ID, partyMembership, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { useJoinPartyAsGuest } from '../use-join-party-as-guest';

describe('apps/client/web: useJoinPartyAsGuest', () => {
  it('takes a guest seat with the invite and marks every party query stale', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(joinWatchPartyAsGuest, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(
          {
            membership: partyMembership('guest:aGuestIdOfSixteenChars'),
            expiresAt: '2026-11-05T22:00:00.000Z',
          },
          { status: 201 }
        );
      })
    );
    const client = createQueryClient();
    client.setQueryData(watchPartyKeys.preview(PARTY_ID), {});

    await runMutation(client, () => useJoinPartyAsGuest(PARTY_ID), 'inv-1', AppProviders);

    expect(bodies).toEqual([{ invite: 'inv-1' }]);
    expect(client.getQueryState(watchPartyKeys.preview(PARTY_ID))?.isInvalidated).toBe(true);
  });

  it('rejects when the room does not allow guests', async () => {
    apiServer.use(
      mockEndpoint(joinWatchPartyAsGuest, () => problemReply(ErrorCodes.WATCH_PARTY_GUESTS_OFF))
    );

    const settled = await runMutation(
      createQueryClient(),
      () => useJoinPartyAsGuest(PARTY_ID),
      undefined,
      AppProviders
    );

    expect(settled.status).toBe('rejected');
  });
});
