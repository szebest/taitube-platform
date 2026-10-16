import { getMyReaction } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { VIDEO_ID, apiServer } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { api, mockEndpoint } from '@vp/web-testing';
import { myReactionQueryOptions } from '../reaction-queries';

describe('apps/client/web: reaction queries', () => {
  it("reads the caller's reaction to a video", async () => {
    apiServer.use(
      mockEndpoint(getMyReaction, ({ params }) =>
        HttpResponse.json({ videoId: String(params.id), reaction: 'LIKE' })
      )
    );

    const loaded = await createQueryClient().fetchQuery(myReactionQueryOptions(api, VIDEO_ID));

    expect(loaded).toEqual({ videoId: VIDEO_ID, reaction: 'LIKE' });
  });

  it('keys the reaction by the video', () => {
    expect(myReactionQueryOptions(api, 'a').queryKey).not.toEqual(
      myReactionQueryOptions(api, 'b').queryKey
    );
  });
});
