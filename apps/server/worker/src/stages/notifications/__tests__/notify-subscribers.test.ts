import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { NotificationKind } from '@vp/domain';
import type { NotifySubscribersJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createNotifySubscribersProcessor } from '../notify-subscribers';
import {
  CHANNEL_ID,
  logger,
  notificationsOf,
  seedCreator,
  seedSubscriber,
  seedVideo,
  userId,
  videoId,
} from './notification-harness';

const job = (data: NotifySubscribersJob): QueueJob<NotifySubscribersJob> => ({
  id: `${data.videoId}--notify-subscribers--${data.kind}`,
  name: 'notify-subscribers',
  data,
});

describe('apps/server/worker/stages: notify-subscribers', () => {
  let repositories: InMemoryRepositories;
  let queue: InMemoryJobQueue;

  const processor = (batchSize?: number) =>
    createNotifySubscribersProcessor({
      repositories,
      getQueue: () => queue,
      logger,
      batchSize,
    });

  const fanOut = async (n: number, kind: 'upload' | 'live' = 'upload', batchSize?: number) =>
    expectOk(await processor(batchSize)(job({ kind, videoId: videoId(n) })));

  const received = async (n: number) =>
    (await notificationsOf(repositories, userId(n))).map((row) => row.kind);

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    queue = new InMemoryJobQueue('notify');
    await seedCreator(repositories);
    await seedVideo(repositories, videoId(1));
  });

  it.each<{ scenario: string; level: 'all' | 'highlights' | 'none'; kind: NotificationKind[] }>([
    { scenario: 'all', level: 'all', kind: ['upload'] },
    { scenario: 'highlights', level: 'highlights', kind: ['upload'] },
    { scenario: 'none', level: 'none', kind: [] },
  ])('gives a subscriber at level $scenario $kind for an upload', async ({ level, kind }) => {
    await seedSubscriber(repositories, userId(1), { level });

    await fanOut(1);

    expect(await received(1)).toEqual(kind);
  });

  it.each<{ level: 'all' | 'highlights' | 'none'; kind: NotificationKind[] }>([
    { level: 'all', kind: ['live'] },
    { level: 'highlights', kind: [] },
    { level: 'none', kind: [] },
  ])('gives a subscriber at level $level $kind for a live start', async ({ level, kind }) => {
    await seedSubscriber(repositories, userId(1), { level });

    await fanOut(1, 'live');

    expect(await received(1)).toEqual(kind);
  });

  it('gives nothing to a subscriber whose uploads switch is off, and the rest still get theirs', async () => {
    await seedSubscriber(repositories, userId(1), { switches: { subscriptionUploads: false } });
    await seedSubscriber(repositories, userId(2));

    const result = await fanOut(1);

    expect(await received(1)).toEqual([]);
    expect(await received(2)).toEqual(['upload']);
    expect(result.recorded).toBe(1);
  });

  it('puts the newest actor and the video in the notification', async () => {
    await seedSubscriber(repositories, userId(1));

    await fanOut(1);

    const [row] = await notificationsOf(repositories, userId(1));
    expect(row).toMatchObject({
      actorChannelId: CHANNEL_ID,
      videoId: videoId(1),
      payload: { count: 1, actor: { handle: 'night-kitchen' }, videoTitle: 'Video 01' },
    });
  });

  it('shows three uploads from one channel inside the hour as one row with a count', async () => {
    await seedSubscriber(repositories, userId(1));
    await seedVideo(repositories, videoId(2));
    await seedVideo(repositories, videoId(3));

    await fanOut(1);
    await fanOut(2);
    await fanOut(3);

    const rows = await notificationsOf(repositories, userId(1));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload.count).toBe(3);
  });

  it('counts nothing twice when the same fan-out runs again', async () => {
    await seedSubscriber(repositories, userId(1));

    await fanOut(1);
    const again = await fanOut(1);

    expect((await notificationsOf(repositories, userId(1)))[0]?.payload.count).toBe(1);
    expect(again.recorded).toBe(0);
  });

  it.each([
    { scenario: 'private', visibility: 'private' as const },
    { scenario: 'not there', visibility: undefined },
  ])('notifies nobody about a video that is $scenario', async ({ visibility }) => {
    await seedSubscriber(repositories, userId(1));
    if (visibility) await seedVideo(repositories, videoId(2), { visibility });

    const result = await fanOut(visibility ? 2 : 9);

    expect(result).toMatchObject({ recorded: 0, hasMore: false });
    expect(await received(1)).toEqual([]);
  });

  it('walks a big channel in batches, each enqueuing the next after its last subscriber', async () => {
    for (const n of [1, 2, 3]) await seedSubscriber(repositories, userId(n));

    const first = await fanOut(1, 'upload', 2);

    expect(first).toMatchObject({ recorded: 2, hasMore: true });
    const [next] = expectOk(await queue.getJobs());
    expect(next).toMatchObject({
      name: 'notify-subscribers',
      data: { kind: 'upload', videoId: videoId(1), after: userId(2) },
    });

    const last = expectOk(
      await processor(2)(job({ kind: 'upload', videoId: videoId(1), after: userId(2) }))
    );
    expect(last).toMatchObject({ recorded: 1, hasMore: false });
    expect(await received(3)).toEqual(['upload']);
  });
});
