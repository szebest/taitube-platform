import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { CommentTarget } from '@vp/domain';
import { commentSubjectOf } from '../notify-comment-subject';
import {
  CHANNEL_ID,
  CREATOR_ID,
  channelOf,
  postId,
  seedCreator,
  seedPost,
  seedVideo,
  userId,
  videoId,
} from './notification-harness';

const VIDEO = videoId(1);
const POST = postId(1);
const THREAD = '00000000-0000-7000-8000-0000000007f1';
const FAN = userId(42);

describe('apps/server/worker/stages: comment subject', () => {
  let repositories: InMemoryRepositories;

  const startThread = async (moderationState: 'published' | 'held' = 'published') =>
    expectOk(
      await repositories.videoThreads.create(
        {
          id: THREAD,
          videoId: VIDEO,
          channelId: CHANNEL_ID,
          authorId: FAN,
          authorChannelId: channelOf(FAN),
          anchorMs: 1_000,
          title: 'The cut',
          body: '',
          moderation: {
            moderationState,
            moderationDisclosure: null,
            heldReason: null,
            looksLikeQuestion: false,
          },
        },
        5
      )
    );
  const subjectOf = async (target: CommentTarget) =>
    expectOk(await commentSubjectOf(repositories, target));

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await seedCreator(repositories);
    await seedVideo(repositories, VIDEO, { title: 'Clip' });
    await seedPost(repositories, POST);
    await startThread();
  });

  it.each([
    {
      name: 'a video',
      target: { type: 'video', id: VIDEO } as const,
      subject: { videoId: VIDEO, videoTitle: 'Clip', link: {} },
    },
    {
      name: 'a post',
      target: { type: 'post', id: POST } as const,
      subject: { videoId: null, videoTitle: null, link: { postId: POST } },
    },
    {
      name: 'a viewer thread',
      target: { type: 'thread', id: THREAD } as const,
      subject: { videoId: VIDEO, videoTitle: 'Clip', link: { threadId: THREAD } },
    },
  ])(
    'names $name by what a notification of it opens, owned by the channel owner',
    async ({ target, subject }) => {
      expect(await subjectOf(target)).toMatchObject({ ownerId: CREATOR_ID, ...subject });
    }
  );

  it.each([
    { name: 'a video that is gone', target: { type: 'video', id: videoId(9) } as const },
    { name: 'a post that is gone', target: { type: 'post', id: postId(9) } as const },
    { name: 'a thread that is gone', target: { type: 'thread', id: userId(9) } as const },
  ])('has no subject for $name', async ({ target }) => {
    expect(await subjectOf(target)).toBeNull();
  });

  it('has no subject for a thread out of public reads', async () => {
    repositories.videoThreads.clear();
    await startThread('held');

    expect(await subjectOf({ type: 'thread', id: THREAD })).toBeNull();
  });

  it('has no subject for the thread of a shadow banned author', async () => {
    expectOk(
      await repositories.channelUserRestrictions.apply({
        channelId: CHANNEL_ID,
        userId: FAN,
        kind: 'shadow',
        reason: null,
        expiresAt: null,
        createdBy: CREATOR_ID,
      })
    );

    expect(await subjectOf({ type: 'thread', id: THREAD })).toBeNull();
  });

  it('lets only the owner hear about a private video, and anyone about a post', async () => {
    await seedVideo(repositories, videoId(2), { visibility: 'private' });

    const video = await subjectOf({ type: 'video', id: videoId(2) });
    const post = await subjectOf({ type: 'post', id: POST });

    expect([video?.mayHear(CREATOR_ID), video?.mayHear(FAN), post?.mayHear(FAN)]).toEqual([
      true,
      false,
      true,
    ]);
  });
});
