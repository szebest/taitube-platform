import type { InfiniteData } from '@tanstack/react-query';
import {
  createPostComment,
  getPost,
  likePost,
  type PostPageView,
  type PostView,
  recordPostOpen,
  recordPostShareClick,
  unlikePost,
  votePost,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { api, apiServer, channel, comment, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import type { PropsWithChildren } from 'react';
import { ApiProvider } from '../api-provider';
import { createQueryClient } from '../create-query-client';
import {
  channelPostsQueryOptions,
  communityFeedQueryOptions,
  postKeys,
  postQueryOptions,
  postViewerKey,
  recordPostOpen as sendOpen,
  recordPostShareClick as sendShareClick,
  useReplyToPost,
  useSetPostLike,
  useVotePost,
} from '../post-queries';

const POST_ID = '0190c3a0-5e1d-7000-8000-0000000e1001';
const OTHER_ID = '0190c3a0-5e1d-7000-8000-0000000e1002';
const VIEWER = 'viewer-1:primary';

function WithApi({ children }: PropsWithChildren) {
  return <ApiProvider api={api}>{children}</ApiProvider>;
}

function post(overrides: Partial<PostView> = {}): PostView {
  const { id, handle, displayName, avatarUrl } = channel();

  return {
    id: POST_ID,
    channel: { id, handle, displayName, avatarUrl },
    kind: 'text',
    body: { kind: 'text', text: 'Hello' },
    commentsEnabled: true,
    likeCount: 3,
    commentsCount: 0,
    likedByViewer: false,
    pinned: false,
    isEdited: false,
    publishedAt: '2026-10-14T09:12:00.000Z',
    version: 1,
    ...overrides,
  };
}

function seed(client: ReturnType<typeof createQueryClient>, posts: PostView[]) {
  const channelKey = channelPostsQueryOptions(api, channel().id, VIEWER).queryKey;
  const feedKey = communityFeedQueryOptions(api, VIEWER).queryKey;
  const detailKey = postQueryOptions(api, POST_ID, VIEWER).queryKey;
  const pages: InfiniteData<PostPageView, string | undefined> = {
    pages: [{ items: posts, nextCursor: null }],
    pageParams: [undefined],
  };
  client.setQueryData(channelKey, pages);
  client.setQueryData(feedKey, pages);
  client.setQueryData(detailKey, posts[0]);

  return {
    channelPosts: () => client.getQueryData(channelKey)?.pages[0]?.items,
    feed: () => client.getQueryData(feedKey)?.pages[0]?.items,
    detail: () => client.getQueryData(detailKey),
    states: () => [channelKey, feedKey, detailKey].map((key) => client.getQueryState(key)),
  };
}

describe('@vp/queries: post keys', () => {
  it.each([
    {
      name: 'a channel list',
      key: postKeys.channel('c1', VIEWER),
      tail: ['channel', 'c1', VIEWER],
    },
    {
      name: 'a guest channel list',
      key: postKeys.channel('c1', null),
      tail: ['channel', 'c1', 'guest'],
    },
    { name: 'the community feed', key: postKeys.community(VIEWER), tail: ['community', VIEWER] },
    { name: 'a guest community feed', key: postKeys.community(null), tail: ['community', 'guest'] },
  ])('keeps $name under its viewer', ({ key, tail }) => {
    expect(key).toEqual(['posts', 'list', ...tail]);
  });

  it('keeps one post under each viewer', () => {
    expect(postKeys.detail(POST_ID, VIEWER)).not.toEqual(
      postKeys.detail(POST_ID, 'viewer-2:primary')
    );
    expect(postKeys.detail(POST_ID, null)).toEqual(['posts', 'detail', POST_ID, 'guest']);
  });

  it.each([
    { account: undefined, channelId: undefined, key: null },
    { account: { id: 'u1' }, channelId: undefined, key: 'u1:primary' },
    { account: { id: 'u1' }, channelId: 'c9', key: 'u1:c9' },
  ])('names the viewer $key for $account acting as $channelId', ({ account, channelId, key }) => {
    expect(postViewerKey(account, channelId)).toBe(key);
  });
});

describe('@vp/queries: post reads', () => {
  it('reads one post by id', async () => {
    apiServer.use(mockEndpoint(getPost, () => HttpResponse.json(post())));
    const client = createQueryClient();

    await expect(client.fetchQuery(postQueryOptions(api, POST_ID, null))).resolves.toMatchObject({
      id: POST_ID,
    });
  });
});

describe('@vp/queries: useSetPostLike', () => {
  it.each([
    { liked: true, contract: likePost, count: 4 },
    { liked: false, contract: unlikePost, count: 2 },
  ])(
    'writes the answer of liked=$liked into every list and page showing the post',
    async ({ liked, contract, count }) => {
      apiServer.use(
        mockEndpoint(contract, () =>
          HttpResponse.json({ postId: POST_ID, liked, likeCount: count })
        )
      );
      const client = createQueryClient();
      const read = seed(client, [post(), post({ id: OTHER_ID })]);

      await runMutation(client, useSetPostLike, { postId: POST_ID, liked }, WithApi);

      const expected = { likedByViewer: liked, likeCount: count };
      expect(read.channelPosts()?.[0]).toMatchObject(expected);
      expect(read.feed()?.[0]).toMatchObject(expected);
      expect(read.detail()).toMatchObject(expected);
      expect(read.channelPosts()?.[1]).toMatchObject({ id: OTHER_ID, likeCount: 3 });
    }
  );

  it('changes nothing when the like is refused', async () => {
    apiServer.use(mockEndpoint(likePost, () => problemReply(ErrorCodes.POST_NOT_FOUND)));
    const client = createQueryClient();
    const read = seed(client, [post()]);

    const outcome = await runMutation(
      client,
      useSetPostLike,
      { postId: POST_ID, liked: true },
      WithApi
    );

    expect(outcome.status).toBe('rejected');
    expect(read.detail()).toMatchObject({ likedByViewer: false, likeCount: 3 });
  });
});

describe('@vp/queries: useVotePost', () => {
  const voted = post({
    body: {
      kind: 'poll',
      question: 'Which?',
      options: [
        { text: 'A', votes: 1 },
        { text: 'B', votes: 0 },
      ],
      closesAt: null,
      closed: false,
      votedIndex: 0,
      totalVotes: 1,
    },
  });

  it('replaces the post in every list with the one that came back', async () => {
    apiServer.use(mockEndpoint(votePost, () => HttpResponse.json(voted)));
    const client = createQueryClient();
    const read = seed(client, [post()]);

    await runMutation(client, useVotePost, { postId: POST_ID, optionIndex: 0 }, WithApi);

    expect(read.channelPosts()?.[0]).toEqual(voted);
    expect(read.feed()?.[0]).toEqual(voted);
    expect(read.detail()).toEqual(voted);
  });

  it.each([
    { code: ErrorCodes.POST_ALREADY_VOTED, refetches: true },
    { code: ErrorCodes.POST_POLL_CLOSED, refetches: true },
    { code: ErrorCodes.POST_NOT_FOUND, refetches: false },
    { code: ErrorCodes.COMMENTS_BANNED, refetches: false },
  ])('answered $code, refetches the posts: $refetches', async ({ code, refetches }) => {
    apiServer.use(mockEndpoint(votePost, () => problemReply(code)));
    const client = createQueryClient();
    const read = seed(client, [post()]);

    const outcome = await runMutation(
      client,
      useVotePost,
      { postId: POST_ID, optionIndex: 0 },
      WithApi
    );

    expect(outcome.status).toBe('rejected');
    expect(read.states().map((state) => state?.isInvalidated)).toEqual(Array(3).fill(refetches));
  });
});

describe('@vp/queries: useReplyToPost', () => {
  it('sends the reply to the post and reloads its replies and count', async () => {
    const sent: unknown[] = [];
    apiServer.use(
      mockEndpoint(createPostComment, async ({ request, params }) => {
        sent.push([params.id, await request.clone().json()]);
        return HttpResponse.json(comment(), { status: 201 });
      })
    );
    const client = createQueryClient();
    const read = seed(client, [post()]);

    await runMutation(client, () => useReplyToPost(POST_ID), { content: 'Nice' }, WithApi);

    expect(sent).toEqual([[POST_ID, { content: 'Nice' }]]);
    expect(read.states().every((state) => state?.isInvalidated)).toBe(true);
  });
});

describe('@vp/queries: post beacons', () => {
  it.each([
    { name: 'open', contract: recordPostOpen, send: sendOpen },
    { name: 'share click', contract: recordPostShareClick, send: sendShareClick },
  ])('posts the $name beacon for the post', async ({ contract, send }) => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(contract, ({ params }) => {
        asked.push(String(params.id));
        return new HttpResponse<null>(null, { status: 204 });
      })
    );

    await send(api, POST_ID);

    expect(asked).toEqual([POST_ID]);
  });

  it.each([
    { name: 'open', contract: recordPostOpen, send: sendOpen },
    { name: 'share click', contract: recordPostShareClick, send: sendShareClick },
  ])('lets a failed $name beacon go unnoticed', async ({ contract, send }) => {
    apiServer.use(mockEndpoint(contract, () => problemReply(ErrorCodes.INTERNAL)));

    await expect(send(api, POST_ID)).resolves.toBeUndefined();
  });
});
