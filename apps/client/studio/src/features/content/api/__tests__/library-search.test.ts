import { LibrarySearchSchema } from '../library-search';

describe('apps/client/studio: library search params', () => {
  it.each([
    { given: 'nothing', search: {}, parsed: { sort: 'newest', page: 1, q: undefined } },
    {
      given: 'a sort, a page and a filter',
      search: { sort: 'likes', page: 3, q: 'night' },
      parsed: { sort: 'likes', page: 3, q: 'night' },
    },
    {
      given: 'a page from the address bar',
      search: { page: '2' },
      parsed: { sort: 'newest', page: 2, q: undefined },
    },
    {
      given: 'a sort the API does not have',
      search: { sort: 'oldest' },
      parsed: { sort: 'newest', page: 1, q: undefined },
    },
    {
      given: 'a page that is not a positive whole number',
      search: { page: '0' },
      parsed: { sort: 'newest', page: 1, q: undefined },
    },
  ])('reads $given', ({ search, parsed }) => {
    expect(LibrarySearchSchema.parse(search)).toEqual(parsed);
  });
});
