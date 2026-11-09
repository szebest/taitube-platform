import { upgradeWatchPartySeat } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, PARTY_ID, partyMembership, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { useUpgradePartySeat } from '../use-upgrade-party-seat';

describe('apps/client/web: useUpgradePartySeat', () => {
  it('asks the API to move the seat of this room', async () => {
    const upgraded: unknown[] = [];
    apiServer.use(
      mockEndpoint(upgradeWatchPartySeat, ({ params }) => {
        upgraded.push(params.id);
        return HttpResponse.json({ membership: partyMembership() });
      })
    );

    const settled = await runMutation(
      createQueryClient(),
      () => useUpgradePartySeat(PARTY_ID),
      undefined,
      AppProviders
    );

    expect(upgraded).toEqual([PARTY_ID]);
    expect(settled.status).toBe('fulfilled');
  });

  it('rejects for a viewer who is not signed in', async () => {
    apiServer.use(mockEndpoint(upgradeWatchPartySeat, () => problemReply(ErrorCodes.UNAUTHORIZED)));

    const settled = await runMutation(
      createQueryClient(),
      () => useUpgradePartySeat(PARTY_ID),
      undefined,
      AppProviders
    );

    expect(settled.status).toBe('rejected');
  });
});
