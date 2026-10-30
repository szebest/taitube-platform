import { createQueryClient } from '@vp/queries';
import { api, apiServer } from '@vp/web-testing';

import { historyReply } from '#app/features/search/__tests__/search-fixtures';
import { recentSearchesQueryOptions, searchHistoryKeys } from '../search-history-queries';

const ENTRY_ID = '0190c3a0-5e1d-7000-8000-00000000e001';

describe('apps/client/web: search history queries', () => {
  it('lists the newest eight searches, always asking again', async () => {
    let limit: string | null = null;
    apiServer.use(historyReply([{ id: ENTRY_ID, query: 'lofi' }]));
    apiServer.events.on('request:start', ({ request }) => {
      limit = new URL(request.url).searchParams.get('limit');
    });

    const options = recentSearchesQueryOptions(api);
    const { items } = await createQueryClient().fetchQuery(options);

    expect(items).toEqual([expect.objectContaining({ id: ENTRY_ID, query: 'lofi' })]);
    expect(limit).toBe('8');
    expect(options.staleTime).toBe(0);
    expect(options.queryKey).toEqual(searchHistoryKeys.recent());
  });
});
