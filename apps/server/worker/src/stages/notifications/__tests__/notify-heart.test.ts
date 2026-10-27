import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { NotifyHeartJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createNotifyHeartProcessor } from '../notify-heart';
import {
  CREATOR_ID,
  logger,
  notificationsOf,
  saveSwitches,
  seedCreator,
  seedVideo,
  userId,
  videoId,
} from './notification-harness';

const VIDEO = videoId(1);
const FAN = userId(42);
const COMMENT = '00000000-0000-7000-8000-000000000901';

describe('apps/server/worker/stages: notify-heart', () => {
  let repositories: InMemoryRepositories;

  const setUp = async (options: { visibility?: 'public' | 'private'; author?: string } = {}) => {
    repositories = new InMemoryRepositories();
    await seedCreator(repositories);
    await seedVideo(repositories, VIDEO, { visibility: options.visibility });
    expectOk(await repositories.users.upsert({ id: FAN, email: 'fan@example.com' }));
    expectOk(
      await repositories.comments.create({
        id: COMMENT,
        videoId: VIDEO,
        authorId: options.author ?? FAN,
        parentId: null,
        content: 'lovely video',
      })
    );
  };

  const heart = async () =>
    expectOk(await repositories.comments.setHearted({ id: COMMENT, videoId: VIDEO }, true));

  const notify = async () => {
    const job: QueueJob<NotifyHeartJob> = {
      id: `${COMMENT}--notify-heart`,
      name: 'notify-heart',
      data: { videoId: VIDEO, commentId: COMMENT },
    };
    return expectOk(await createNotifyHeartProcessor({ repositories, logger })(job));
  };

  it("tells the comment's author that the creator hearted it", async () => {
    await setUp();
    await heart();

    await notify();

    expect(await notificationsOf(repositories, FAN)).toMatchObject([
      {
        kind: 'heart',
        videoId: VIDEO,
        commentId: COMMENT,
        payload: { actor: { handle: 'night-kitchen' }, excerpt: 'lovely video', count: 1 },
      },
    ]);
  });

  it('says it once when the job runs again', async () => {
    await setUp();
    await heart();

    await notify();
    expect(await notify()).toMatchObject({ recorded: false });

    expect(await notificationsOf(repositories, FAN)).toHaveLength(1);
  });

  it.each([
    { scenario: 'the heart was taken back', prepare: async () => {} },
    {
      scenario: 'the switch is off',
      prepare: async () => {
        await heart();
        await saveSwitches(repositories, FAN, { repliesAndMentions: false });
      },
    },
  ])('says nothing when $scenario', async ({ prepare }) => {
    await setUp();
    await prepare();

    expect(await notify()).toMatchObject({ recorded: false });
    expect(await notificationsOf(repositories, FAN)).toEqual([]);
  });

  it.each([
    { scenario: 'a private video', options: { visibility: 'private' as const }, reader: FAN },
    { scenario: "the creator's own comment", options: { author: CREATOR_ID }, reader: CREATOR_ID },
  ])('says nothing about $scenario', async ({ options, reader }) => {
    await setUp(options);
    await heart();

    expect(await notify()).toMatchObject({ recorded: false });
    expect(await notificationsOf(repositories, reader)).toEqual([]);
  });
});
