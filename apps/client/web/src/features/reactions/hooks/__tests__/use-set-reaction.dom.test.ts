import type { QueryClient } from '@tanstack/react-query';
import { type ContractResult, type UserReaction, setReaction } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { HttpResponse } from 'msw/http';
import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint, problemReply } from '#app/__tests__/msw/mock-endpoint';
import { heldReply, runMutation } from '#app/__tests__/render-mutation';
import { myReactionQueryOptions } from '#app/features/reactions/api/reaction-queries';
import { videoQueryOptions } from '#app/features/videos/api/video-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { useSetReaction } from '../use-set-reaction';

const reactionKey = myReactionQueryOptions(VIDEO_ID).queryKey;
const videoKey = videoQueryOptions(VIDEO_ID).queryKey;

function reacted() {
  return HttpResponse.json<ContractResult<typeof setReaction>>({
    videoId: VIDEO_ID,
    reaction: 'LIKE',
    likesCount: 11,
    dislikesCount: 4,
  });
}

function seeded(reaction: UserReaction['reaction']): QueryClient {
  const client = createQueryClient();
  client.setQueryData(reactionKey, { videoId: VIDEO_ID, reaction });
  client.setQueryData(videoKey, video({ likesCount: 10, dislikesCount: 4 }));
  return client;
}

function cached(client: QueryClient) {
  const cachedVideo = client.getQueryData(videoKey);
  return {
    reaction: client.getQueryData(reactionKey)?.reaction,
    likes: cachedVideo?.likesCount,
    dislikes: cachedVideo?.dislikesCount,
  };
}

describe('apps/client/web: useSetReaction', () => {
  it.each([
    { from: null, choice: 'LIKE', reaction: 'LIKE', likes: 11, dislikes: 4 },
    { from: 'DISLIKE', choice: 'LIKE', reaction: 'LIKE', likes: 11, dislikes: 3 },
    { from: 'LIKE', choice: 'NONE', reaction: null, likes: 9, dislikes: 4 },
    { from: 'LIKE', choice: 'DISLIKE', reaction: 'DISLIKE', likes: 9, dislikes: 5 },
  ] as const)(
    'shows $choice over $from before the API answers',
    async ({ from, choice, reaction, likes, dislikes }) => {
      const held = heldReply(reacted);
      apiServer.use(mockEndpoint(setReaction, held.answer));
      const client = seeded(from);

      const running = runMutation(client, () => useSetReaction(VIDEO_ID), choice);
      await vi.waitFor(() => expect(cached(client).reaction).toBe(reaction));

      expect(cached(client)).toEqual({ reaction, likes, dislikes });
      held.release();
      await running;
    }
  );

  it('rolls the reaction and the counts back when the request fails', async () => {
    apiServer.use(mockEndpoint(setReaction, () => problemReply(ErrorCodes.INTERNAL)));
    const client = seeded('DISLIKE');

    const settled = await runMutation(client, () => useSetReaction(VIDEO_ID), 'LIKE');

    expect(settled.status).toBe('rejected');
    expect(cached(client)).toEqual({ reaction: 'DISLIKE', likes: 10, dislikes: 4 });
  });

  it('sends the choice and marks the reaction and the video stale once settled', async () => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(setReaction, async ({ request }) => {
        bodies.push(await request.json());
        return reacted();
      })
    );
    const client = seeded(null);

    await runMutation(client, () => useSetReaction(VIDEO_ID), 'LIKE');

    expect(bodies).toEqual([{ type: 'LIKE' }]);
    expect(client.getQueryState(reactionKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(videoKey)?.isInvalidated).toBe(true);
  });
});
