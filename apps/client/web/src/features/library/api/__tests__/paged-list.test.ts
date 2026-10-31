import type { InfiniteData } from '@tanstack/react-query';
import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';

import { searchHistoryQueryOptions } from '../library-queries';
import { dropItems, editPages, emptyPages, restorePages } from '../paged-list';

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

  describe('editPages and restorePages', () => {
    const key = searchHistoryQueryOptions(api).queryKey;
    const seeded = () => {
      const client = createQueryClient();
      client.setQueryData(key, {
        pages: [{ items: [{ id: 'a', query: 'tram', searchedAt: 'now' }], nextCursor: null }],
        pageParams: [undefined],
      });
      return client;
    };

    it('writes the edit and hands back what was there, to restore', async () => {
      const client = seeded();

      const snapshot = await editPages(client, key, emptyPages);

      expect(client.getQueryData(key)?.pages[0]?.items).toEqual([]);
      restorePages(client, key, snapshot);
      expect(client.getQueryData(key)?.pages[0]?.items).toHaveLength(1);
    });

    it('edits nothing for a list that was never loaded, and restores it to unloaded', async () => {
      const client = createQueryClient();

      const snapshot = await editPages(client, key, emptyPages);
      restorePages(client, key, snapshot);

      expect(client.getQueryData(key)).toBeUndefined();
    });
  });
});
