import { hashKey } from '@tanstack/react-query';
import { api } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { videoSearchQueryOptions } from '#app/features/search/api/search-queries';
import { getRouter } from '#app/router';

async function renderSearch(path: string) {
  const answered: string[] = [];
  const rendered = await serverRender(getRouter, path, { handlers: loaderApi(answered) });
  return { ...rendered, answered };
}

describe('apps/client/web: /search', () => {
  it.each([
    { label: 'words', q: ' Lofi  Beats', query: 'lofi beats' },
    { label: 'a number', q: '2024', query: '2024' },
    { label: 'a decimal', q: '1.10', query: '1.10' },
    { label: 'a JSON literal', q: 'null', query: 'null' },
    { label: 'a JSON object', q: '{"a":1}', query: '{"a":1}' },
  ])(
    'server-renders the videos matching $label, dehydrated under the normalised query',
    async ({ q, query }) => {
      const queryHash = hashKey(videoSearchQueryOptions(api, query).queryKey);

      const { status, html, main, answered } = await renderSearch(
        `/search?${new URLSearchParams({ q })}`
      );

      expect(status).toBe(200);
      expect(main).toContain(`Results for ${query.replaceAll('"', '&quot;')}`);
      expect(main).toContain('Search hit');
      expect(html).toContain(`queryHash:${JSON.stringify(queryHash)}`);
      expect(answered).toEqual(['/v1/search']);
    }
  );

  it.each([
    { label: 'no query', path: '/search' },
    { label: 'a blank query', path: '/search?q=%20%20' },
    { label: 'exclusions alone', path: '/search?q=-lofi' },
  ])('asks for a word, and not the API, on $label', async ({ path }) => {
    const { status, main, answered } = await renderSearch(path);

    expect(status).toBe(200);
    expect(main).toContain('Type a word to search for');
    expect(answered).toEqual([]);
  });
});
