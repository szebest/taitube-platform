import { SEARCH_SUGGESTIONS } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { inMemorySearchSuggestionIndexSubject } from '../../__tests__/contract/in-memory-port-subjects';
import { describeSearchSuggestionIndexContract } from '../../__tests__/contract/search-suggestion-index.contract';
import { InMemorySearchSuggestionIndex } from '../in-memory-search-suggestion-index';

describeSearchSuggestionIndexContract(inMemorySearchSuggestionIndexSubject);

describe('InMemorySearchSuggestionIndex', () => {
  it('forgets every prefix on clear', async () => {
    const index = new InMemorySearchSuggestionIndex();
    expectOk(await index.record('react'));

    index.clear();

    expect(expectOk(await index.suggest('r', SEARCH_SUGGESTIONS.limit))).toEqual([]);
  });
});
