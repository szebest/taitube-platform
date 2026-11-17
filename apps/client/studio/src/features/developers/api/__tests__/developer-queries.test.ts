import { createQueryClient } from '@vp/queries';
import { api, apiServer } from '@vp/web-testing';
import {
  dataExport,
  serveDevelopers,
  token,
  webhook,
} from '#app/features/developers/__tests__/developers-api.fixture';
import {
  apiTokensQueryOptions,
  developerKeys,
  exportsQueryOptions,
  webhooksQueryOptions,
} from '../developer-queries';

describe('apps/client/studio: developer queries', () => {
  it('keys every query under one root', () => {
    expect(
      [
        apiTokensQueryOptions(api).queryKey,
        webhooksQueryOptions(api).queryKey,
        exportsQueryOptions(api).queryKey,
      ].every((key) => key[0] === developerKeys.all[0])
    ).toBe(true);
  });

  it('reads the tokens, the webhooks and the first page of exports the API lists', async () => {
    apiServer.use(
      ...serveDevelopers({ tokens: [token()], webhooks: [webhook()], exports: [dataExport()] })
        .handlers
    );
    const client = createQueryClient();

    expect((await client.fetchQuery(apiTokensQueryOptions(api))).items).toEqual([token()]);
    expect((await client.fetchQuery(webhooksQueryOptions(api))).items).toEqual([webhook()]);
    expect((await client.fetchInfiniteQuery(exportsQueryOptions(api))).pages[0]?.items).toEqual([
      dataExport(),
    ]);
  });
});
