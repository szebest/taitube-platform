import { getMyReaction } from '@vp/api-contracts';
import { HttpResponse } from 'msw';
import { VIDEO_ID } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { myReactionQueryOptions } from '../reaction-queries';

describe('apps/web: reaction queries', () => {
  it("reads the caller's reaction to a video", async () => {
    apiServer.use(
      mockEndpoint(getMyReaction, ({ params }) =>
        HttpResponse.json({ videoId: String(params.id), reaction: 'LIKE' })
      )
    );

    const loaded = await createQueryClient().fetchQuery(myReactionQueryOptions(VIDEO_ID));

    expect(loaded).toEqual({ videoId: VIDEO_ID, reaction: 'LIKE' });
  });

  it('keys the reaction by the video', () => {
    expect(myReactionQueryOptions('a').queryKey).not.toEqual(myReactionQueryOptions('b').queryKey);
  });
});
