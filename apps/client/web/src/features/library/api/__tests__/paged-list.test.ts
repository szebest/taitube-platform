import type { InfiniteData } from '@tanstack/react-query';
import { dropItems, emptyPages } from '../paged-list';

interface Row {
  id: string;
}
type RowPage = { items: Row[]; nextCursor: string | null };

const pages = (): InfiniteData<RowPage> => ({
  pages: [
    { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'c1' },
    { items: [{ id: 'c' }], nextCursor: null },
  ],
  pageParams: [undefined, 'c1'],
});

const ids = (data: InfiniteData<RowPage>) =>
  data.pages.map((page) => page.items.map(({ id }) => id));

describe('apps/client/web: paged lists', () => {
  describe('dropItems', () => {
    it('removes the matching rows from every page and keeps the cursors', () => {
      const dropped = dropItems(pages(), ({ id }) => id === 'b' || id === 'c');

      expect(ids(dropped)).toEqual([['a'], []]);
      expect(dropped.pages.map(({ nextCursor }) => nextCursor)).toEqual(['c1', null]);
    });
  });

  describe('emptyPages', () => {
    it('leaves one empty page with no cursor to ask for more', () => {
      expect(emptyPages(pages())).toEqual({
        pages: [{ items: [], nextCursor: null }],
        pageParams: [undefined],
      });
    });

    it('leaves a list with no page as it is', () => {
      const none = { pages: [], pageParams: [] };

      expect(emptyPages(none)).toBe(none);
    });
  });
});
