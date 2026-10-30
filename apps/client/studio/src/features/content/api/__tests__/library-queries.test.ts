import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';

import { creatorVideo, videoIdOf } from '#app/features/content/__tests__/creator-video.fixture';
import { serveLibrary } from '#app/features/content/__tests__/library-api.fixture';
import { libraryQueryOptions } from '../library-queries';

const PAGES = [
  { cursor: null, ids: [0, 1], next: 'c2' },
  { cursor: 'c2', ids: [2, 3], next: 'c3' },
  { cursor: 'c3', ids: [4], next: null },
].map(({ ids, ...page }) => ({
  ...page,
  items: ids.map((index) => creatorVideo({ id: videoIdOf(index) })),
}));

const loadLibrary = (sort: 'newest' | 'views', page: number) =>
  createQueryClient().fetchQuery(libraryQueryOptions(api, sort, page));

describe('apps/client/studio: library queries', () => {
  it.each([
    { page: 1, shown: [0, 1], cursors: [null], hasNextPage: true },
    { page: 3, shown: [4], cursors: [null, 'c2', 'c3'], hasNextPage: false },
    { page: 9, shown: [4], cursors: [null, 'c2', 'c3'], hasNextPage: false },
  ])(
    'reaches page $page by following the cursors and answers the page it reached',
    async ({ page, shown, cursors, hasNextPage }) => {
      const requests = serveLibrary(PAGES);

      const view = await loadLibrary('views', page);

      expect(view.items.map(({ id }) => id)).toEqual(shown.map(videoIdOf));
      expect(view.hasNextPage).toBe(hasNextPage);
      expect(view.page).toBe(Math.min(page, 3));
      expect(requests).toEqual(cursors.map((cursor) => ({ sort: 'views', cursor })));
    }
  );

  it.each([
    { visited: 3, target: 2, cursors: ['c2'] },
    { visited: 2, target: 3, cursors: ['c3'] },
    { visited: 3, target: 3, cursors: ['c3'] },
  ])(
    'costs $cursors.length request(s) to reach page $target after page $visited',
    async ({ visited, target, cursors }) => {
      const client = createQueryClient();
      const requests = serveLibrary(PAGES);
      await client.fetchQuery(libraryQueryOptions(api, 'views', visited));
      requests.length = 0;
      client.removeQueries({ queryKey: libraryQueryOptions(api, 'views', target).queryKey });

      await client.fetchQuery(libraryQueryOptions(api, 'views', target));

      expect(requests.map(({ cursor }) => cursor)).toEqual(cursors);
    }
  );

  it('keys a view by its sort and page', () => {
    const keys = [
      libraryQueryOptions(api, 'newest', 1),
      libraryQueryOptions(api, 'newest', 2),
      libraryQueryOptions(api, 'views', 1),
    ].map(({ queryKey }) => JSON.stringify(queryKey));

    expect(new Set(keys).size).toBe(3);
  });
});
