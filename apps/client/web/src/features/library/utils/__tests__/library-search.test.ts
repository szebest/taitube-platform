import { LIBRARY_TABS, LibrarySearchSchema } from '../library-search';

describe('apps/client/web: library search', () => {
  it.each(LIBRARY_TABS)('keeps the %s tab', (tab) => {
    expect(LibrarySearchSchema.parse({ tab }).tab).toBe(tab);
  });

  it.each([{ tab: 'videos' }, { tab: 3 }, { tab: ['liked', 'comments'] }, {}])(
    'leaves the tab out for %j',
    (search) => {
      expect(LibrarySearchSchema.parse(search).tab).toBeUndefined();
    }
  );

  it.each([
    { q: 'tram', parsed: 'tram' },
    { q: '', parsed: undefined },
    { q: '   ', parsed: undefined },
    { q: 4, parsed: undefined },
  ])('reads the filter $q as $parsed', ({ q, parsed }) => {
    expect(LibrarySearchSchema.parse({ q }).q).toBe(parsed);
  });
});
