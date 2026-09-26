import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { VIDEO_ID, video, videoSummary } from '#app/__tests__/fixtures';
import { API_BASE_URL } from '#app/config';
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
    const sent = recordRequests(() => jsonResponse(video({ title: 'Launch day' })));

    const loaded = await createQueryClient().fetchQuery(videoQueryOptions(VIDEO_ID));

    expect(loaded.title).toBe('Launch day');
    expect(sent.map(({ method, url }) => `${method} ${url}`)).toEqual([
      `GET ${API_BASE_URL}/v1/videos/${VIDEO_ID}`,
    ]);
  });

  it("pages through the caller's videos by cursor", async () => {
    const sent = recordRequests((url) =>
      jsonResponse(
        url.includes('cursor=')
          ? { items: [videoSummary({ id: SECOND_VIDEO_ID })], nextCursor: null }
          : { items: [videoSummary()], nextCursor: 'next' }
      )
    );

    const pages = await createQueryClient().fetchInfiniteQuery({
      ...myVideosQueryOptions(),
      pages: 2,
    });

    expect(pages.pages.flatMap((page) => page.items.map((item) => item.id))).toEqual([
      VIDEO_ID,
      SECOND_VIDEO_ID,
    ]);
    expect(sent.map(({ url }) => url)).toContain(`${API_BASE_URL}/v1/videos?limit=30&cursor=next`);
  });
});
