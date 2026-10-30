import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { searchSuggestions } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';

import { AppProviders } from '#app/__tests__/providers';
import {
  channelHit,
  page,
  searchReply,
  suggestionsReply,
  videoResult,
} from '#app/features/search/__tests__/search-fixtures';
import { useSearchSuggestions } from '../use-search-suggestions';

function renderSuggestions(typed: string, enabled = true) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const rendered = renderHook(() => useSearchSuggestions(typed, enabled), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <AppProviders>{children}</AppProviders>
      </QueryClientProvider>
    ),
  });
  return { ...rendered, client };
}

describe('apps/client/web: useSearchSuggestions', () => {
  it('groups the suggestions and hits of the words once they have held still', async () => {
    const asked: string[] = [];
    apiServer.use(
      searchReply(() => page([videoResult(), channelHit()]), asked),
      suggestionsReply([{ type: 'query', text: 'react hooks' }])
    );

    const { result } = renderSuggestions('react');

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.groups.videos).toHaveLength(1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.searched).toBe(true);
    expect(result.current.groups.channels).toHaveLength(1);
    expect(result.current.groups.queries).toEqual([{ kind: 'query', text: 'react hooks' }]);
    expect(asked).toHaveLength(1);
  });

  it.each([
    { scenario: 'nothing is typed', typed: '', enabled: true, searched: false },
    { scenario: 'only blanks are typed', typed: '   ', enabled: true, searched: false },
    { scenario: 'the palette is closed', typed: 'react', enabled: false, searched: true },
  ])('asks for nothing when $scenario', ({ typed, enabled, searched }) => {
    const { result, client } = renderSuggestions(typed, enabled);

    expect(client.isFetching()).toBe(0);
    expect(result.current.searched).toBe(searched);
    expect(result.current.failed).toBe(false);
  });

  it('reports a failure when either request fails', async () => {
    apiServer.use(
      searchReply(() => page([])),
      mockEndpoint(searchSuggestions, () => problemReply(ErrorCodes.INTERNAL))
    );

    const { result } = renderSuggestions('react');

    await waitFor(() => expect(result.current.failed).toBe(true));
  });
});
