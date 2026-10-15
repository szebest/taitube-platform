import { deleteVideo } from '@vp/api-contracts';
import { createQueryClient, myVideosQueryOptions, videoQueryOptions } from '@vp/queries';
import { VIDEO_ID, apiServer, video } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { api, mockEndpoint } from '#app/__tests__/api';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { useDeleteVideo } from '../use-delete-video';

describe('apps/client/web: useDeleteVideo', () => {
  it('drops the deleted video and marks every list stale', async () => {
    apiServer.use(
      mockEndpoint(deleteVideo, ({ params }) =>
        HttpResponse.json({ videoId: String(params.id), status: 'DELETED' }, { status: 202 })
      )
    );
    const detailKey = videoQueryOptions(api, VIDEO_ID).queryKey;
    const listKeys = [
      myVideosQueryOptions(api).queryKey,
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
