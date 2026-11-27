import { ok } from '@kit/result';
import type { Channel, ChannelPost, CommentTarget, Video } from '@vp/domain';
import {
  type CommentTargetStores,
  moveCommentsCount,
  ownerOf,
  sameTarget,
  setCommentsCount,
} from '../comment-targets';

const VIDEO: CommentTarget = { type: 'video', id: 'v1' };
const POST: CommentTarget = { type: 'post', id: 'p1' };

function setUp() {
  const video = { id: 'v1', ownerId: 'video-owner', title: 'Clip', commentsCount: 1 };
  const post = { id: 'p1', channelId: 'ch1', commentsCount: 1 };
  const stores: CommentTargetStores = {
    videosRepo: { findById: async (id) => ok(id === video.id ? (video as Video) : null) },
    postsRepo: { posts: new Map([[post.id, post as ChannelPost]]) },
    channelsRepo: {
      findById: async (id) =>
        ok(id === 'ch1' ? ({ id, userId: 'channel-owner' } as Channel) : null),
    },
  };
  return { stores, video, post };
}

describe('adapters/in-memory: comment targets', () => {
  it.each([
    { left: VIDEO, right: { type: 'video', id: 'v1' }, expected: true },
    { left: VIDEO, right: { type: 'video', id: 'v2' }, expected: false },
    { left: VIDEO, right: { type: 'post', id: 'v1' }, expected: false },
  ] as const)('compares $left with $right', ({ left, right, expected }) => {
    expect(sameTarget(left, right)).toBe(expected);
  });

  it.each([
    {
      scenario: 'a video',
      target: VIDEO,
      expected: { type: 'video', id: 'v1', ownerId: 'video-owner', title: 'Clip' },
    },
    {
      scenario: 'a post, by the owner of its channel',
      target: POST,
      expected: { type: 'post', id: 'p1', ownerId: 'channel-owner' },
    },
    { scenario: 'a missing video', target: { type: 'video', id: 'gone' }, expected: null },
    { scenario: 'a missing post', target: { type: 'post', id: 'gone' }, expected: null },
  ] as const)('names the owner of $scenario', async ({ target, expected }) => {
    expect(await ownerOf(setUp().stores, target)).toEqual(expected);
  });

  it.each([
    { scenario: 'a video', target: VIDEO, pick: 'video' as const },
    { scenario: 'a post', target: POST, pick: 'post' as const },
  ])('moves and sets the count of $scenario', async ({ target, pick }) => {
    const { stores, video, post } = setUp();
    const row = pick === 'video' ? video : post;

    await moveCommentsCount(stores, target, 2);
    const moved = row.commentsCount;
    await setCommentsCount(stores, target, 7);

    expect([moved, row.commentsCount]).toEqual([3, 7]);
  });

  it.each(['video', 'post'] as const)('leaves everything alone for a missing %s', async (type) => {
    const { stores, video, post } = setUp();

    await moveCommentsCount(stores, { type, id: 'gone' }, 5);
    await setCommentsCount(stores, { type, id: 'gone' }, 5);

    expect([video.commentsCount, post.commentsCount]).toEqual([1, 1]);
  });
});
