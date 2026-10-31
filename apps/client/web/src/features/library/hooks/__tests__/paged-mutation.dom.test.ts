import { useMutation } from '@tanstack/react-query';
import { clearSearchHistory } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';

import { searchItem } from '../../__tests__/library-fixtures';
import { searchHistoryQueryOptions } from '../../api/library-queries';
import { emptyPages } from '../../api/paged-list';
import { pagedMutationOptions } from '../paged-mutation';

const key = searchHistoryQueryOptions(api).queryKey;
const BESIDE = ['beside', 'the', 'list'] as const;

const options = (invalidate?: (typeof BESIDE)[]) =>
  pagedMutationOptions({
    key,
    request: () => api.searchHistory.clearSearchHistory(),
    edit: emptyPages,
    invalidate: invalidate ?? undefined,
  });

function seeded() {
  const client = createQueryClient();
  client.setQueryData(key, {
    pages: [{ items: [searchItem(1)], nextCursor: null }],
    pageParams: [undefined],
  });
  client.setQueryData(BESIDE, 'cached');
  return client;
}

describe('apps/client/web: pagedMutationOptions', () => {
  beforeEach(() => {
    apiServer.use(
      mockEndpoint(clearSearchHistory, () => new HttpResponse<null>(null, { status: 204 }))
    );
  });

  it('invalidates the list itself once the request settles, when it names no other key', async () => {
    const client = seeded();

    await runMutation(client, () => useMutation(options()), undefined, AppProviders);

    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(BESIDE)?.isInvalidated).toBe(false);
  });

  it('invalidates the keys it names instead, the list among them when it says so', async () => {
    const client = seeded();

    await runMutation(client, () => useMutation(options([BESIDE])), undefined, AppProviders);

    expect(client.getQueryState(BESIDE)?.isInvalidated).toBe(true);
  });
});
