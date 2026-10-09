import { search, searchSuggestions } from '../search';

const VIDEO = {
  id: '00000000-0000-7000-8000-0000000047a1',
  ownerId: '00000000-0000-7000-8000-0000000047e1',
  title: 'Learn React',
  description: null,
  visibility: 'public',
  status: 'READY',
  version: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('packages/api-contracts: search', () => {
  it.each([
    [search, '/v1/search'],
    [searchSuggestions, '/v1/search/suggestions'],
  ])('is an anonymous GET %#', (endpoint, path) => {
    expect(endpoint).toMatchObject({ method: 'GET', path, anonymous: true, status: 200 });
  });

  it('searches everything by relevance, 20 at a time, unless asked otherwise', () => {
    expect(search.query.parse({ q: 'react' })).toEqual({
      q: 'react',
      type: 'all',
      sort: 'relevance',
      limit: 20,
    });
  });

  it.each([
    { name: 'an unknown type', query: { q: 'react', type: 'music' } },
    { name: 'an unknown sort', query: { q: 'react', sort: 'oldest' } },
    { name: 'a page past 50', query: { q: 'react', limit: 51 } },
    { name: 'a non-uuid category', query: { q: 'react', categoryId: 'games' } },
    { name: 'no query at all', query: {} },
  ])('rejects $name', ({ query }) => {
    expect(search.query.safeParse(query).success).toBe(false);
  });

  it('tells the kinds of result apart by type', () => {
    const page = {
      items: [
        { type: 'video', data: VIDEO },
        {
          type: 'channel',
          data: {
            id: VIDEO.ownerId,
            handle: 'fireship',
            displayName: 'Fireship',
            avatarUrl: null,
            bio: null,
            subscriberCount: 3,
          },
        },
      ],
      nextCursor: null,
      tookMs: 1.5,
      total: 2,
      fuzzyFallback: false,
    };

    expect(search.result.parse(page).items.map((item) => item.type)).toEqual(['video', 'channel']);
    expect(
      search.result.safeParse({ ...page, items: [{ type: 'channel', data: VIDEO }] }).success
    ).toBe(false);
  });

  it('carries a channel suggestion with the channel it opens', () => {
    const channel = {
      type: 'channel',
      text: 'Fireship',
      channelId: VIDEO.ownerId,
      handle: 'fireship',
      avatarUrl: null,
    };

    expect(
      searchSuggestions.result.parse({ items: [{ type: 'query', text: 'react' }, channel] })
    ).toEqual({ items: [{ type: 'query', text: 'react' }, channel] });
    expect(
      searchSuggestions.result.safeParse({ items: [{ type: 'channel', text: 'x' }] }).success
    ).toBe(false);
  });
});
