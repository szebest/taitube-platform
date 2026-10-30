import { hashKey } from '@tanstack/react-query';
import { api } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';

import { loaderApi } from '#app/__tests__/loader-api';
import { searchQueryOptions } from '#app/features/search/api/search-queries';
import { channelHit, page, searchReply } from '#app/features/search/__tests__/search-fixtures';
import { getRouter } from '#app/router';

async function renderSearch(path: string, asked: string[] = []) {
  const answered: string[] = [];
  const rendered = await serverRender(getRouter, path, {
    handlers: [searchReply(() => page([channelHit()]), asked), ...loaderApi(answered)],
  });
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
    'server-renders the results for $label, dehydrated under the normalised query',
    async ({ q, query }) => {
      const queryHash = hashKey(
        searchQueryOptions(api, { query, type: 'all', sort: 'relevance' }).queryKey
      );

      const { status, html, main } = await renderSearch(`/search?${new URLSearchParams({ q })}`);

      expect(status).toBe(200);
      expect(main).toContain(`Results for ${query.replaceAll('"', '&quot;')}`);
      expect(main).toContain('React Conf');
      expect(html).toContain(`queryHash:${JSON.stringify(queryHash)}`);
    }
  );

  it('server-renders the channels sorted by date for a shared URL', async () => {
    const asked: string[] = [];

    const { main } = await renderSearch('/search?q=react&type=channel&sort=date', asked);

    expect(asked).toEqual(['q=react&type=channel&sort=date&limit=30']);
    expect(main).toContain('React Conf');
    expect(main).toContain('Upload date');
  });

  it.each([
    { label: 'an unknown type', path: '/search?q=react&type=short', canonical: '/search?q=react' },
    { label: 'an unknown sort', path: '/search?q=react&sort=oldest', canonical: '/search?q=react' },
    {
      label: 'a blank type',
      path: '/search?q=react&type=&sort=date',
      canonical: '/search?q=react&sort=date',
    },
  ])(
    'sends $label to the URL with the defaults, and asks nothing yet',
    async ({ path, canonical }) => {
      const asked: string[] = [];

      const { status, location } = await renderSearch(path, asked);

      expect(status).toBe(307);
      expect(location).toBe(canonical);
      expect(asked).toEqual([]);
    }
  );

  it.each([
    { label: 'no query', path: '/search' },
    { label: 'a blank query', path: '/search?q=%20%20' },
    { label: 'exclusions alone', path: '/search?q=-lofi' },
  ])('asks for a word, and not the API, on $label', async ({ path }) => {
    const asked: string[] = [];

    const { status, main } = await renderSearch(path, asked);

    expect(status).toBe(200);
    expect(main).toContain('Type a word to search for');
    expect(asked).toEqual([]);
  });
});
