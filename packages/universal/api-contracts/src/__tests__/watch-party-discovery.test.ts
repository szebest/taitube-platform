import { listWatchParties } from '../watch-party-discovery';

describe('packages/api-contracts: watch party discovery', () => {
  it('reads an empty query as the unfiltered members walk', () => {
    expect(listWatchParties.query.parse({})).toEqual({
      status: 'all',
      access: 'any',
      size: 'any',
      space: false,
      followed: false,
      creator: false,
      kind: 'any',
      sort: 'members',
      limit: 24,
    });
  });

  it.each([
    {
      scenario: 'every filter named',
      query: { status: 'lobby', space: 'true', sort: 'trending' },
      ok: true,
    },
    { scenario: 'a status it does not know', query: { status: 'soon' }, ok: false },
    { scenario: 'a limit of 48', query: { limit: '48' }, ok: true },
    { scenario: 'a limit of 49', query: { limit: '49' }, ok: false },
    {
      scenario: 'a language that is not a primary subtag',
      query: { language: 'en-GB' },
      ok: false,
    },
    { scenario: 'a category that is not an id', query: { category: 'music' }, ok: false },
  ])('accepts $scenario: $ok', ({ query, ok }) => {
    expect(listWatchParties.query.safeParse(query).success).toBe(ok);
  });
});
