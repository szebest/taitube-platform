import { getClip, listMyClips } from '@vp/api-contracts';
import { VIDEO_ID, api, apiServer, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { clipKeys, clipQueryOptions, myClipsQueryOptions } from '../clip-queries';
import { createQueryClient } from '../create-query-client';

const CLIP_ID = '0190c3a0-5e1d-7000-8000-00000000c001';
const SECOND_CLIP_ID = '0190c3a0-5e1d-7000-8000-00000000c002';

const clip = (id = CLIP_ID) => ({
  id,
  videoId: VIDEO_ID,
  userId: '0190c3a0-5e1d-7000-8000-00000000a0a1',
  startMs: 10_000,
  endMs: 30_000,
  title: 'The goal',
  createdAt: '2026-03-01T12:00:00.000Z',
  video: videoSummary(),
});

describe('@vp/queries: clip queries', () => {
  it('keys the detail by the clip, so two clips never share a cache entry', () => {
    expect(clipQueryOptions(api, 'a').queryKey).not.toEqual(clipQueryOptions(api, 'b').queryKey);
  });

  it.each([
    { query: 'the detail', queryKey: clipQueryOptions(api, CLIP_ID).queryKey },
    { query: 'the caller list', queryKey: myClipsQueryOptions(api).queryKey },
  ])('files $query under the clips key, so one invalidation reaches it', ({ queryKey }) => {
    expect(queryKey.slice(0, clipKeys.all.length)).toEqual([...clipKeys.all]);
  });

  it('loads a clip through the API client', async () => {
    apiServer.use(
      mockEndpoint(getClip, ({ params }) => HttpResponse.json(clip(String(params.id))))
    );

    const loaded = await createQueryClient().fetchQuery(clipQueryOptions(api, CLIP_ID));

    expect(loaded).toMatchObject({ id: CLIP_ID, startMs: 10_000, endMs: 30_000 });
  });

  it("pages through the caller's clips by cursor", async () => {
    const cursors: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(listMyClips, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(
          cursor
            ? { items: [clip(SECOND_CLIP_ID)], nextCursor: null }
            : { items: [clip()], nextCursor: 'next' }
        );
      })
    );

    const pages = await createQueryClient().fetchInfiniteQuery({
      ...myClipsQueryOptions(api),
      pages: 2,
    });

    expect(pages.pages.flatMap((page) => page.items.map((item) => item.id))).toEqual([
      CLIP_ID,
      SECOND_CLIP_ID,
    ]);
    expect(cursors).toEqual([null, 'next']);
  });
});
