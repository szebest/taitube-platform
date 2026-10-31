import { removeSearchHistoryEntry } from '@vp/api-contracts';
import { api } from '@vp/web-testing';

import { searchItem, uuid } from '../../__tests__/library-fixtures';
import { searchHistoryQueryOptions } from '../../api/library-queries';
import { useRemoveSearch } from '../use-remove-search';
import { itChangesTheListOptimistically } from './optimistic-list';

describe('apps/client/web: useRemoveSearch', () => {
  itChangesTheListOptimistically({
    key: searchHistoryQueryOptions(api).queryKey,
    contract: removeSearchHistoryEntry,
    pages: [[searchItem(1), searchItem(2)], [searchItem(3)]],
    hook: () => useRemoveSearch(uuid(2002)),
    variables: undefined,
    idOf: ({ id }) => id,
    remaining: [uuid(2001), uuid(2003)],
  });
});
