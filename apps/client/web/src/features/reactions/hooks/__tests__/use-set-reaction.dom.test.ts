import type { QueryClient } from '@tanstack/react-query';
import { type ContractResult, setReaction, type UserReaction } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient, videoQueryOptions } from '@vp/queries';
import { api, apiServer, mockEndpoint, problemReply, VIDEO_ID, video } from '@vp/web-testing';
import { heldReply, runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { myReactionQueryOptions } from '#app/features/reactions/api/reaction-queries';
import { useSetReaction } from '../use-set-reaction';

const reactionKey = myReactionQueryOptions(api, VIDEO_ID).queryKey;
const videoKey = videoQueryOptions(api, VIDEO_ID).queryKey;

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

      const running = runMutation(client, () => useSetReaction(VIDEO_ID), choice, AppProviders);
      await vi.waitFor(() => expect(cached(client).reaction).toBe(reaction));

      expect(cached(client)).toEqual({ reaction, likes, dislikes });
      held.release();
      await running;
    }
  );

  it('rolls the reaction and the counts back when the request fails', async () => {
    apiServer.use(mockEndpoint(setReaction, () => problemReply(ErrorCodes.INTERNAL)));
    const client = seeded('DISLIKE');

    const settled = await runMutation(client, () => useSetReaction(VIDEO_ID), 'LIKE', AppProviders);

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

    await runMutation(client, () => useSetReaction(VIDEO_ID), 'LIKE', AppProviders);

    expect(bodies).toEqual([{ type: 'LIKE' }]);
    expect(client.getQueryState(reactionKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(videoKey)?.isInvalidated).toBe(true);
  });

  it.each([
    { name: 'a worker holds the change', controller: {}, reaction: 'LIKE', stale: false },
    { name: 'no worker holds the change', controller: null, reaction: 'DISLIKE', stale: true },
  ])(
    'on a network error, keeps the choice and skips the refetch only when $name',
    async ({ controller, reaction, stale }) => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller },
        configurable: true,
      });
      apiServer.use(mockEndpoint(setReaction, () => HttpResponse.error()));
      const client = seeded('DISLIKE');

      await runMutation(client, () => useSetReaction(VIDEO_ID), 'LIKE', AppProviders);

      expect(client.getQueryData(reactionKey)?.reaction).toBe(reaction);
      expect(client.getQueryState(reactionKey)?.isInvalidated).toBe(stale);
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  );
});
