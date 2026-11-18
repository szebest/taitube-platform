import { listVideoCorrections, listVideoRevisions } from '@vp/api-contracts';
import { VIDEO_ID, api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { createQueryClient } from '../create-query-client';
import { videoKeys } from '../video-queries';
import {
  correctionsQueryOptions,
  revisionsQueryOptions,
  videoToolKeys,
} from '../video-tool-queries';

const correction = {
  id: '0190c3a0-5e1d-7000-8000-00000000d001',
  videoId: VIDEO_ID,
  startMs: 10_000,
  endMs: 15_000,
  text: 'The price is 5 dollars',
  createdAt: '2026-03-01T12:00:00.000Z',
};

const revision = (version: number) => ({
  id: `0190c3a0-5e1d-7000-8000-00000000e0${String(version).padStart(2, '0')}`,
  version,
  snapshot: {
    title: 'T',
    description: null,
    tags: [],
    categoryId: null,
    visibility: 'public' as const,
    thumbnail: { source: 'poster' as const },
    chapters: [],
    commentsEnabled: true,
  },
  authorUserId: null,
  note: null,
  createdAt: '2026-03-01T12:00:00.000Z',
});

describe('@vp/queries: video tool queries', () => {
  it.each([
    { query: 'the corrections', queryKey: videoToolKeys.corrections(VIDEO_ID) },
    { query: 'the revisions', queryKey: videoToolKeys.revisions(VIDEO_ID) },
  ])(
    'files $query under the video detail key, so one invalidation reaches them',
    ({ queryKey }) => {
      expect(queryKey.slice(0, videoKeys.detail(VIDEO_ID).length)).toEqual(
        videoKeys.detail(VIDEO_ID)
      );
    }
  );

  it('loads the corrections of a video through the API client', async () => {
    apiServer.use(
      mockEndpoint(listVideoCorrections, () => HttpResponse.json({ items: [correction] }))
    );

    const loaded = await createQueryClient().query(correctionsQueryOptions(api, VIDEO_ID));

    expect(loaded.items).toEqual([correction]);
  });

  it('pages through the history by cursor', async () => {
    const cursors: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(listVideoRevisions, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(
          cursor
            ? { items: [revision(1)], nextCursor: null }
            : { items: [revision(2)], nextCursor: 'next' }
        );
      })
    );
    const client = createQueryClient();
    const options = revisionsQueryOptions(api, VIDEO_ID);

    const first = await client.fetchInfiniteQuery({ ...options, pages: 2 });

    expect(cursors).toEqual([null, 'next']);
    expect(first.pages.flatMap((page) => page.items.map((item) => item.version))).toEqual([2, 1]);
  });
});
