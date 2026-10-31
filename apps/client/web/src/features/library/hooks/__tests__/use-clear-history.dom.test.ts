import { clearWatchHistory } from '@vp/api-contracts';
import { api } from '@vp/web-testing';

import { historyItem } from '#app/features/library/__tests__/library-fixtures';
import { watchHistoryQueryOptions } from '#app/features/library/api/library-queries';
import { useClearHistory } from '../use-clear-history';
import { itChangesTheListOptimistically } from './optimistic-list';

describe('apps/client/web: useClearHistory', () => {
  itChangesTheListOptimistically({
    key: watchHistoryQueryOptions(api).queryKey,
    contract: clearWatchHistory,
    pages: [[historyItem(1), historyItem(2)], [historyItem(3)]],
    hook: useClearHistory,
    variables: undefined,
    idOf: ({ videoId }) => videoId,
    remaining: [],
  });
});
