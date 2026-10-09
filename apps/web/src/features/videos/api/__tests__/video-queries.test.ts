import { getVideo, listVideos } from '@vp/api-contracts';
import { HttpResponse } from 'msw/http';
import { VIDEO_ID, video, videoSummary } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { myVideosQueryOptions, videoKeys, videoQueryOptions } from '../video-queries';

const SECOND_VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a002';

describe('apps/web: video queries', () => {
  it('keys the detail by the video, so two videos never share a cache entry', () => {
    expect(videoQueryOptions('a').queryKey).not.toEqual(videoQueryOptions('b').queryKey);
  });

  it.each([
    { query: 'the detail', queryKey: videoQueryOptions(VIDEO_ID).queryKey },
    { query: 'the caller list', queryKey: myVideosQueryOptions().queryKey },
  ])('files $query under the videos key, so one invalidation reaches it', ({ queryKey }) => {
    expect(queryKey.slice(0, videoKeys.all.length)).toEqual([...videoKeys.all]);
  });

  it('loads the video detail through the API client', async () => {
    apiServer.use(
      mockEndpoint(getVideo, ({ params }) =>
        HttpResponse.json(video({ id: String(params.id), title: 'Launch day' }))
      )
    );

    const loaded = await createQueryClient().fetchQuery(videoQueryOptions(VIDEO_ID));

    expect(loaded).toMatchObject({ id: VIDEO_ID, title: 'Launch day' });
  });

  it("pages through the caller's videos by cursor", async () => {
    const cursors: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(listVideos, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(
          cursor
            ? { items: [videoSummary({ id: SECOND_VIDEO_ID })], nextCursor: null }
            : { items: [videoSummary()], nextCursor: 'next' }
        );
      })
    );

    const pages = await createQueryClient().fetchInfiniteQuery({
      ...myVideosQueryOptions(),
      pages: 2,
    });

    expect(pages.pages.flatMap((page) => page.items.map((item) => item.id))).toEqual([
      VIDEO_ID,
      SECOND_VIDEO_ID,
    ]);
    expect(cursors).toEqual([null, 'next']);
  });
});
