import { QueryClient } from '@tanstack/react-query';
import { jsonResponse, recordRequests } from '../../../../__tests__/api-store';
import { VIDEO_ID, video } from '../../../../__tests__/fixtures';
import { videoQueryOptions } from '../video-query-options';

describe('apps/web: videoQueryOptions', () => {
  it('keys the query by the video, so two videos never share a cache entry', () => {
    expect(videoQueryOptions('a').queryKey).not.toEqual(videoQueryOptions('b').queryKey);
  });

  it('loads the video detail through the API client', async () => {
    const sent = recordRequests(() => jsonResponse(video({ title: 'Launch day' })));

    const loaded = await new QueryClient().fetchQuery(videoQueryOptions(VIDEO_ID));

    expect(loaded.title).toBe('Launch day');
    expect(sent.map(({ method, url }) => `${method} ${url}`)).toEqual([
      `GET http://localhost:3000/v1/videos/${VIDEO_ID}`,
    ]);
  });
});
