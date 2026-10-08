import { deleteVideo } from '@vp/api-contracts';
import { HttpResponse } from 'msw/http';
import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { runMutation } from '#app/__tests__/render-mutation';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { myVideosQueryOptions, videoQueryOptions } from '#app/features/videos/api/video-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { useDeleteVideo } from '../use-delete-video';

describe('apps/web: useDeleteVideo', () => {
  it('drops the deleted video and marks every list stale', async () => {
    apiServer.use(
      mockEndpoint(deleteVideo, ({ params }) =>
        HttpResponse.json({ videoId: String(params.id), status: 'DELETED' }, { status: 202 })
      )
    );
    const detailKey = videoQueryOptions(VIDEO_ID).queryKey;
    const listKeys = [
      myVideosQueryOptions().queryKey,
      publicFeedQueryOptions({ sort: 'recent' }).queryKey,
    ];
    const client = createQueryClient();
    client.setQueryData(detailKey, video());
    for (const queryKey of listKeys) client.setQueryData(queryKey, { pages: [], pageParams: [] });

    const settled = await runMutation(client, () => useDeleteVideo(VIDEO_ID), undefined);

    expect(settled.status).toBe('fulfilled');
    expect(client.getQueryData(detailKey)).toBeUndefined();
    for (const queryKey of listKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });
});
