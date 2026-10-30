import { waitFor } from '@testing-library/react';
import { removeSearchHistoryEntry } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply, runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { recentSearchesQueryOptions } from '#app/features/search/api/search-history-queries';
import { useRemoveRecentSearch } from '../use-remove-recent-search';

const LOFI_ID = '0190c3a0-5e1d-7000-8000-00000000e001';
const JAZZ_ID = '0190c3a0-5e1d-7000-8000-00000000e002';
const recentKey = recentSearchesQueryOptions(api).queryKey;

function seeded() {
  const client = createQueryClient();
  client.setQueryData(recentKey, {
    items: [
      { id: LOFI_ID, query: 'lofi', searchedAt: '2026-01-02T00:00:00.000Z' },
      { id: JAZZ_ID, query: 'jazz', searchedAt: '2026-01-02T00:00:00.000Z' },
    ],
    nextCursor: null,
  });
  return client;
}

const cachedIds = (client: ReturnType<typeof seeded>) =>
  client.getQueryData(recentKey)?.items.map((entry) => entry.id);

describe('apps/client/web: useRemoveRecentSearch', () => {
  it('drops the entry from the cache while the request is in flight', async () => {
    const removed: string[] = [];
    const held = heldReply(() => new HttpResponse<null>(null, { status: 204 }));
    apiServer.use(
      mockEndpoint(removeSearchHistoryEntry, ({ params }) => {
        removed.push(String(params.id));
        return held.answer();
      })
    );
    const client = seeded();

    const settled = runMutation(client, useRemoveRecentSearch, LOFI_ID, AppProviders);

    await waitFor(() => expect(cachedIds(client)).toEqual([JAZZ_ID]));
    held.release();
    await settled;
    expect(removed).toEqual([LOFI_ID]);
  });

  it('marks the history stale once the request settles', async () => {
    apiServer.use(
      mockEndpoint(removeSearchHistoryEntry, () => new HttpResponse(null, { status: 204 }))
    );
    const client = seeded();

    await runMutation(client, useRemoveRecentSearch, LOFI_ID, AppProviders);

    expect(client.getQueryState(recentKey)?.isInvalidated).toBe(true);
  });

  it('puts the entry back when the request fails', async () => {
    apiServer.use(mockEndpoint(removeSearchHistoryEntry, () => problemReply(ErrorCodes.INTERNAL)));
    const client = seeded();

    const outcome = await runMutation(client, useRemoveRecentSearch, LOFI_ID, AppProviders);

    expect(outcome.status).toBe('rejected');
    expect(cachedIds(client)).toEqual([LOFI_ID, JAZZ_ID]);
  });
});
