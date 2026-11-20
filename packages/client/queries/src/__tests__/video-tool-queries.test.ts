import {
  listVideoCorrections,
  listVideoExperiments,
  listVideoRevisions,
  listVideoShareLinks,
} from '@vp/api-contracts';
import { VIDEO_ID, api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { createQueryClient } from '../create-query-client';
import { videoKeys } from '../video-queries';
import {
  correctionsQueryOptions,
  experimentsQueryOptions,
  revisionsQueryOptions,
  shareLinksQueryOptions,
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
  restoredFromVersion: null,
  createdAt: '2026-03-01T12:00:00.000Z',
});

const shareLink = {
  id: '0190c3a0-5e1d-7000-8000-00000000f001',
  token: 'abcdefghijklmnopqrstuv',
  label: 'Press',
  expiresAt: null,
  revokedAt: null,
  createdAt: '2026-03-01T12:00:00.000Z',
  state: 'active' as const,
  stats: { opens: 1, views: 2, watchSeconds: 30 },
};

const experiment = {
  id: '0190c3a0-5e1d-7000-8000-00000000f101',
  videoId: VIDEO_ID,
  kind: 'title' as const,
  variants: [
    { id: 'a' as const, title: 'A', thumbnail: null },
    { id: 'b' as const, title: 'B', thumbnail: null },
  ],
  status: 'running' as const,
  startedAt: '2026-03-01T12:00:00.000Z',
  endedAt: null,
  winnerVariantId: null,
  results: { enoughData: false, variants: [] },
};

describe('@vp/queries: video tool queries', () => {
  it.each([
    { query: 'the corrections', queryKey: videoToolKeys.corrections(VIDEO_ID) },
    { query: 'the revisions', queryKey: videoToolKeys.revisions(VIDEO_ID) },
    { query: 'the share links', queryKey: videoToolKeys.shareLinks(VIDEO_ID) },
    { query: 'the tests', queryKey: videoToolKeys.experiments(VIDEO_ID) },
  ])(
    'files $query under the video detail key, so one invalidation reaches them',
    ({ queryKey }) => {
      expect(queryKey.slice(0, videoKeys.detail(VIDEO_ID).length)).toEqual(
        videoKeys.detail(VIDEO_ID)
      );
    }
  );

  it.each([
    {
      name: 'corrections',
      item: correction,
      serve: () =>
        mockEndpoint(listVideoCorrections, () => HttpResponse.json({ items: [correction] })),
      load: () => createQueryClient().query(correctionsQueryOptions(api, VIDEO_ID)),
    },
    {
      name: 'share links',
      item: shareLink,
      serve: () =>
        mockEndpoint(listVideoShareLinks, () => HttpResponse.json({ items: [shareLink] })),
      load: () => createQueryClient().query(shareLinksQueryOptions(api, VIDEO_ID)),
    },
    {
      name: 'tests',
      item: experiment,
      serve: () =>
        mockEndpoint(listVideoExperiments, () => HttpResponse.json({ items: [experiment] })),
      load: () => createQueryClient().query(experimentsQueryOptions(api, VIDEO_ID)),
    },
  ])('loads the $name of a video through the API client', async ({ item, serve, load }) => {
    apiServer.use(serve());

    const loaded = await load();

    expect(loaded.items).toEqual([item]);
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
