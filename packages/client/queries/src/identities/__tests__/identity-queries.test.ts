import { listMyIdentities } from '@vp/api-contracts';
import { api, apiServer, identities, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { createQueryClient } from '../../create-query-client';
import {
  accountGlanceQueryOptions,
  accountsListQueryOptions,
  identitiesQueryOptions,
  identityKeys,
} from '../identity-queries';

describe('@vp/queries: identity queries', () => {
  it('reads the active account identities from the API', async () => {
    apiServer.use(mockEndpoint(listMyIdentities, () => HttpResponse.json(identities())));

    await expect(createQueryClient().fetchQuery(identitiesQueryOptions(api))).resolves.toEqual(
      identities()
    );
  });

  it.each([
    { open: true, interval: 60_000 },
    { open: false, interval: false },
  ])('asks the other accounts every minute only while open ($open)', ({ open, interval }) => {
    expect(accountGlanceQueryOptions(3, open)).toMatchObject({
      queryKey: identityKeys.glance(3),
      enabled: open,
      refetchInterval: interval,
    });
  });

  it('keys the slot list under the identities', () => {
    expect(accountsListQueryOptions().queryKey).toEqual(['identities', 'accounts']);
  });
});
