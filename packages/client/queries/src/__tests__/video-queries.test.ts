import { getVideo, getVideoRetention, listVideos } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint, VIDEO_ID, video, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { createQueryClient } from '../create-query-client';
import {
  myVideosQueryOptions,
  videoKeys,
  videoQueryOptions,
  videoRetentionQueryOptions,
} from '../video-queries';

const SECOND_VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a002';

describe('@vp/queries: video queries', () => {
  it('keys the detail by the video, so two videos never share a cache entry', () => {
    expect(videoQueryOptions(api, 'a').queryKey).not.toEqual(videoQueryOptions(api, 'b').queryKey);
  });

  it.each([
    { query: 'the detail', queryKey: videoQueryOptions(api, VIDEO_ID).queryKey },
    { query: 'the retention curve', queryKey: videoRetentionQueryOptions(api, VIDEO_ID).queryKey },
    { query: 'the caller list', queryKey: myVideosQueryOptions(api).queryKey },
  ])('files $query under the videos key, so one invalidation reaches it', ({ queryKey }) => {
    expect(queryKey.slice(0, videoKeys.all.length)).toEqual([...videoKeys.all]);
  });

  it('loads the video detail through the API client', async () => {
    apiServer.use(
      mockEndpoint(getVideo, ({ params }) =>
        HttpResponse.json(video({ id: String(params.id), title: 'Launch day' }))
      )
    );

    const loaded = await createQueryClient().fetchQuery(videoQueryOptions(api, VIDEO_ID));

    expect(loaded).toMatchObject({ id: VIDEO_ID, title: 'Launch day' });
  });

  it('loads the retention curve of the video through the API client', async () => {
    const curve = [{ percent: 0, viewers: 10 }];
    apiServer.use(
      mockEndpoint(getVideoRetention, ({ params }) =>
        HttpResponse.json({ videoId: String(params.id), curve })
      )
    );

    const loaded = await createQueryClient().fetchQuery(videoRetentionQueryOptions(api, VIDEO_ID));

    expect(loaded).toEqual({ videoId: VIDEO_ID, curve });
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
      ...myVideosQueryOptions(api),
      pages: 2,
    });

    expect(pages.pages.flatMap((page) => page.items.map((item) => item.id))).toEqual([
      VIDEO_ID,
      SECOND_VIDEO_ID,
    ]);
    expect(cursors).toEqual([null, 'next']);
  });
});
