import { getRelatedVideos } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { VIDEO_ID, api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { relatedQueryOptions } from '../related-queries';

describe('apps/client/web: related queries', () => {
  it('reads the videos related to one video', async () => {
    const asked: unknown[] = [];
    apiServer.use(
      mockEndpoint(getRelatedVideos, ({ params }) => {
        asked.push(params.id);
        return HttpResponse.json({ items: [] });
      })
    );

    await createQueryClient().fetchQuery(relatedQueryOptions(api, VIDEO_ID));

    expect(asked).toEqual([VIDEO_ID]);
  });
});
