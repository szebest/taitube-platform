import type { QueueJob } from '@kit/ports';
import { expectOk } from '@kit/testing/result';
import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NotificationKind } from '@vp/domain';
import type { NotifyPostSubscribersJob } from '@vp/job-contracts';
import { createNotifyPostSubscribersProcessor } from '../notify-post-subscribers';
import {
  CHANNEL_ID,
  logger,
  notificationsOf,
  postId,
  seedCreator,
  seedPost,
  seedSubscriber,
  userId,
} from './notification-harness';

const job = (data: NotifyPostSubscribersJob): QueueJob<NotifyPostSubscribersJob> => ({
  id: `${data.postId}--notify-post-subscribers`,
  name: 'notify-post-subscribers',
  data,
});

describe('apps/server/worker/stages: notify-post-subscribers', () => {
  let repositories: InMemoryRepositories;
  let queue: InMemoryJobQueue;

  const processor = (batchSize?: number) =>
    createNotifyPostSubscribersProcessor({
      repositories,
      getQueue: () => queue,
      logger,
      batchSize,
    });

  const fanOut = async (n: number, batchSize?: number) =>
    expectOk(await processor(batchSize)(job({ postId: postId(n) })));

  const received = async (n: number) =>
    (await notificationsOf(repositories, userId(n))).map((row) => row.kind);

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    queue = new InMemoryJobQueue('notify');
    await seedCreator(repositories);
    await seedPost(repositories, postId(1));
  });

  it.each<{ level: 'all' | 'highlights' | 'none'; kind: NotificationKind[] }>([
    { level: 'all', kind: ['post'] },
    { level: 'highlights', kind: [] },
    { level: 'none', kind: [] },
  ])('gives a subscriber at level $level $kind for a post', async ({ level, kind }) => {
    await seedSubscriber(repositories, userId(1), { level });

    await fanOut(1);

    expect(await received(1)).toEqual(kind);
  });

  it('gives nothing to a subscriber whose uploads switch is off, and the rest still get theirs', async () => {
    await seedSubscriber(repositories, userId(1), { switches: { subscriptionUploads: false } });
    await seedSubscriber(repositories, userId(2));

    const result = await fanOut(1);

    expect(await received(1)).toEqual([]);
    expect(await received(2)).toEqual(['post']);
    expect(result.recorded).toBe(1);
  });

  it('puts the channel, the post and its excerpt in the notification', async () => {
    await seedSubscriber(repositories, userId(1));

    await fanOut(1);

    const [row] = await notificationsOf(repositories, userId(1));
    expect(row).toMatchObject({
      actorChannelId: CHANNEL_ID,
      videoId: null,
      commentId: null,
      payload: {
        count: 1,
        postId: postId(1),
        videoTitle: null,
        excerpt: 'Post 01',
        actor: { handle: 'night-kitchen' },
      },
    });
  });

  it('shows three posts from one channel inside the hour as one row with a count', async () => {
    await seedSubscriber(repositories, userId(1));
    await seedPost(repositories, postId(2));
    await seedPost(repositories, postId(3));

    await fanOut(1);
    await fanOut(2);
    await fanOut(3);

    const rows = await notificationsOf(repositories, userId(1));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ payload: { count: 3, postId: postId(3) } });
  });

  it('counts nothing twice when the same fan-out runs again', async () => {
    await seedSubscriber(repositories, userId(1));

    await fanOut(1);
    const again = await fanOut(1);

    expect((await notificationsOf(repositories, userId(1)))[0]?.payload.count).toBe(1);
    expect(again.recorded).toBe(0);
  });

  it.each([
    { scenario: 'not there', post: 9, status: undefined },
    { scenario: 'a draft', post: 1, status: 'draft' as const },
    { scenario: 'still scheduled', post: 1, status: 'scheduled' as const },
  ])('notifies nobody about a post that is $scenario', async ({ post, status }) => {
    await seedSubscriber(repositories, userId(1));
    if (status) Object.assign(repositories.channelPosts.posts.get(postId(post)) ?? {}, { status });

    const result = await fanOut(post);

    expect(result).toMatchObject({ recorded: 0, hasMore: false });
    expect(await received(1)).toEqual([]);
  });

  it('walks a big channel in batches, each enqueuing the next after its last subscriber', async () => {
    for (const n of [1, 2, 3]) await seedSubscriber(repositories, userId(n));

    const first = await fanOut(1, 2);

    expect(first).toMatchObject({ recorded: 2, hasMore: true });
    const [next] = expectOk(await queue.getJobs());
    expect(next).toMatchObject({
      name: 'notify-post-subscribers',
      data: { postId: postId(1), after: userId(2) },
    });

    const last = expectOk(await processor(2)(job({ postId: postId(1), after: userId(2) })));
    expect(last).toMatchObject({ recorded: 1, hasMore: false });
    expect(await received(3)).toEqual(['post']);
  });
});
