import { DiscoverySearchSchema, filtersOf, isNarrowed } from '../discovery-search';

const CATEGORY = '0190c3a0-5e1d-7000-8000-00000000e001';

describe('apps/client/web: discovery search params', () => {
  it('reads an empty URL as the unfiltered members view', () => {
    const filters = filtersOf(DiscoverySearchSchema.parse({}));

    expect(filters).toEqual({
      status: 'all',
      access: 'any',
      size: 'any',
      space: false,
      followed: false,
      creator: false,
      kind: 'any',
      sort: 'members',
    });
    expect(isNarrowed(filters)).toBe(false);
  });

  it('reads a copied filtered URL back as the same view', () => {
    const search = DiscoverySearchSchema.parse({
      q: 'Movie Night',
      status: 'lobby',
      category: CATEGORY,
      language: 'pl',
      access: 'password',
      size: 'small',
      space: 'true',
      followed: true,
      creator: 'true',
      kind: 'playlist',
      sort: 'trending',
    });

    expect(filtersOf(search)).toEqual({
      q: 'movie night',
      status: 'lobby',
      category: CATEGORY,
      language: 'pl',
      access: 'password',
      size: 'small',
      space: true,
      followed: true,
      creator: true,
      kind: 'playlist',
      sort: 'trending',
    });
  });

  it.each([
    { scenario: 'an unknown status', search: { status: 'soon' } },
    { scenario: 'a category that is not an id', search: { category: 'music' } },
    { scenario: 'a language that is not a primary subtag', search: { language: 'en-GB' } },
    { scenario: 'a flag that is not true', search: { space: 'maybe', creator: 'false' } },
    { scenario: 'a sort it does not know', search: { sort: 'loudest' } },
    { scenario: 'a search of exclusions only', search: { q: '-movie' } },
  ])('falls back to the default for $scenario', ({ search }) => {
    const filters = filtersOf(DiscoverySearchSchema.parse(search));

    expect(filters).toMatchObject({
      status: 'all',
      space: false,
      creator: false,
      sort: 'members',
    });
    expect(filters).not.toHaveProperty('category');
    expect(filters).not.toHaveProperty('language');
    expect(filters).not.toHaveProperty('q');
  });

  it.each([
    { search: { sort: 'newest' }, narrowed: false },
    { search: { status: 'now' }, narrowed: true },
    { search: { space: true }, narrowed: true },
    { search: { q: 'tram' }, narrowed: true },
  ])('says $search narrows: $narrowed', ({ search, narrowed }) => {
    expect(isNarrowed(filtersOf(DiscoverySearchSchema.parse(search)))).toBe(narrowed);
  });
});
