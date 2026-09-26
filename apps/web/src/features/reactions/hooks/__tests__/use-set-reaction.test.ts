import type { QueryClient } from '@tanstack/react-query';
import type { UserReaction } from '@vp/api-contracts';
import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { problemResponse, runMutation } from '#app/__tests__/run-mutation';
import { videoQueryOptions } from '#app/features/videos/api/video-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { myReactionQueryOptions } from '#app/features/reactions/api/reaction-queries';
import { setReactionMutationOptions } from '../use-set-reaction';

const reactionKey = myReactionQueryOptions(VIDEO_ID).queryKey;
const videoKey = videoQueryOptions(VIDEO_ID).queryKey;

function seeded(reaction: UserReaction['reaction']): QueryClient {
  const client = createQueryClient();
  client.setQueryData(reactionKey, { videoId: VIDEO_ID, reaction });
  client.setQueryData(videoKey, video({ likesCount: 10, dislikesCount: 4 }));
  return client;
}

function cachedCounts(client: QueryClient) {
  const cached = client.getQueryData(videoKey);
  return {
    reaction: client.getQueryData(reactionKey)?.reaction,
    likes: cached?.likesCount,
    dislikes: cached?.dislikesCount,
  };
}

function holdResponse(): () => void {
  let release = () => {};
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        release = () =>
          resolve(
            jsonResponse({ videoId: VIDEO_ID, reaction: 'LIKE', likesCount: 11, dislikesCount: 4 })
          );
      })
  );
  return () => release();
}

describe('apps/web: setReactionMutationOptions', () => {
  it.each([
    { from: null, choice: 'LIKE', reaction: 'LIKE', likes: 11, dislikes: 4 },
    { from: 'DISLIKE', choice: 'LIKE', reaction: 'LIKE', likes: 11, dislikes: 3 },
    { from: 'LIKE', choice: 'NONE', reaction: null, likes: 9, dislikes: 4 },
    { from: 'LIKE', choice: 'DISLIKE', reaction: 'DISLIKE', likes: 9, dislikes: 5 },
  ] as const)(
    'shows $choice over $from before the API answers',
    async ({ from, choice, reaction, likes, dislikes }) => {
      const release = holdResponse();
      const client = seeded(from);

      const running = runMutation(client, setReactionMutationOptions(VIDEO_ID), choice);
      await vi.waitFor(() => expect(cachedCounts(client).reaction).toBe(reaction));

      expect(cachedCounts(client)).toEqual({ reaction, likes, dislikes });
      release();
      await running;
    }
  );

  it('rolls the reaction and the counts back when the request fails', async () => {
    recordRequests(() => problemResponse(500));
    const client = seeded('DISLIKE');

    const settled = await runMutation(client, setReactionMutationOptions(VIDEO_ID), 'LIKE');

    expect(settled.status).toBe('rejected');
    expect(cachedCounts(client)).toEqual({ reaction: 'DISLIKE', likes: 10, dislikes: 4 });
  });

  it('asks the API again for the reaction and the video once settled', async () => {
    const sent = recordRequests(() =>
      jsonResponse({ videoId: VIDEO_ID, reaction: 'LIKE', likesCount: 11, dislikesCount: 4 })
    );
    const client = seeded(null);

    await runMutation(client, setReactionMutationOptions(VIDEO_ID), 'LIKE');

    expect(sent[0]).toMatchObject({ method: 'PUT', body: { type: 'LIKE' } });
    expect(client.getQueryState(reactionKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(videoKey)?.isInvalidated).toBe(true);
  });
});
