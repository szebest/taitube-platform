import { clearSearchHistory } from '@vp/api-contracts';
import { api } from '@vp/web-testing';

import { searchItem } from '../../__tests__/library-fixtures';
import { searchHistoryQueryOptions } from '../../api/library-queries';
import { useClearSearches } from '../use-clear-searches';
import { itChangesTheListOptimistically } from './optimistic-list';

describe('apps/client/web: useClearSearches', () => {
  itChangesTheListOptimistically({
    key: searchHistoryQueryOptions(api).queryKey,
    contract: clearSearchHistory,
    pages: [[searchItem(1), searchItem(2)], [searchItem(3)]],
    hook: useClearSearches,
    variables: undefined,
    idOf: ({ id }) => id,
    remaining: [],
  });
});
