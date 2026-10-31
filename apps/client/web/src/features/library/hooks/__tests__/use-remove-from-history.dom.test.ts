import { removeWatchHistoryEntry } from '@vp/api-contracts';
import { api } from '@vp/web-testing';

import { historyItem, uuid } from '#app/features/library/__tests__/library-fixtures';
import { watchHistoryQueryOptions } from '#app/features/library/api/library-queries';
import { useRemoveFromHistory } from '../use-remove-from-history';
import { itChangesTheListOptimistically } from './optimistic-list';

describe('apps/client/web: useRemoveFromHistory', () => {
  itChangesTheListOptimistically({
    key: watchHistoryQueryOptions(api).queryKey,
    contract: removeWatchHistoryEntry,
    pages: [[historyItem(1), historyItem(2)], [historyItem(3)]],
    hook: () => useRemoveFromHistory(uuid(2)),
    variables: undefined,
    idOf: ({ videoId }) => videoId,
    remaining: [uuid(1), uuid(3)],
  });
});
