import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { VIDEO_ID } from '#app/__tests__/fixtures';
import { API_BASE_URL } from '#app/config';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { myReactionQueryOptions } from '../reaction-queries';

describe('apps/web: reaction queries', () => {
  it("reads the caller's reaction to a video", async () => {
    const sent = recordRequests(() => jsonResponse({ videoId: VIDEO_ID, reaction: 'LIKE' }));

    const loaded = await createQueryClient().fetchQuery(myReactionQueryOptions(VIDEO_ID));

    expect(loaded.reaction).toBe('LIKE');
    expect(sent.map(({ url }) => url)).toEqual([
      `${API_BASE_URL}/v1/videos/${VIDEO_ID}/reactions/me`,
    ]);
  });

  it('keys the reaction by the video', () => {
    expect(myReactionQueryOptions('a').queryKey).not.toEqual(myReactionQueryOptions('b').queryKey);
  });
});
