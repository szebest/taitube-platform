import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { NotifyModerationJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createNotifyModerationProcessor } from '../notify-moderation';
import {
  CHANNEL_ID,
  CREATOR_ID,
  logger,
  notificationsOf,
  seedCreator,
  userId,
} from './notification-harness';

const AUTHOR = userId(7);
const EVENT = '00000000-0000-7000-8000-000000000e01';
const COMMENT = '00000000-0000-7000-8000-000000000c01';
const VIDEO = '00000000-0000-7000-8000-000000000a01';

describe('apps/server/worker/stages: notify-moderation', () => {
  let repositories: InMemoryRepositories;

  const job = (overrides: Partial<NotifyModerationJob>): QueueJob<NotifyModerationJob> => ({
    id: `${EVENT}--notify-moderation`,
    name: 'notify-moderation',
    data: {
      eventId: EVENT,
      userId: AUTHOR,
      action: 'remove',
      channelId: CHANNEL_ID,
      videoId: VIDEO,
      commentId: COMMENT,
      reason: 'spam',
      expiresAt: null,
      excerpt: 'the start of it',
      ...overrides,
    },
  });
  const run = async (overrides: Partial<NotifyModerationJob>) =>
    expectOk(await createNotifyModerationProcessor({ repositories, logger })(job(overrides)));

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await seedCreator(repositories);
    expectOk(await repositories.users.upsert({ id: AUTHOR, email: 'author@example.com' }));
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: CREATOR_ID,
        sourceKey: 'raw/v/source.mp4',
        title: 'Open',
        visibility: 'public',
        status: 'READY',
      })
    );
    expectOk(
      await repositories.comments.create({
        id: COMMENT,
        videoId: VIDEO,
        authorId: AUTHOR,
        parentId: null,
        content: 'hello',
      })
    );
  });

  it('tells the author of a removal with the reason, the excerpt and the channel as the actor', async () => {
    const result = await run({});

    expect(result).toEqual({ eventId: EVENT, recorded: true });
    expect(await notificationsOf(repositories, AUTHOR)).toMatchObject([
      {
        kind: 'moderation',
        commentId: COMMENT,
        payload: {
          excerpt: 'the start of it',
          moderation: { action: 'remove', reason: 'spam', expiresAt: null },
        },
      },
    ]);
  });

  it('tells a user once, however often the job runs', async () => {
    await run({});
    const again = await run({});

    expect(again.recorded).toBe(false);
    expect(await notificationsOf(repositories, AUTHOR)).toHaveLength(1);
  });

  it.each([
    { scenario: 'a hold that was approved since', action: 'hold' as const, standing: false },
    { scenario: 'a hide that still stands', action: 'hide' as const, standing: true },
    {
      scenario: 'a hold without its comment',
      action: 'hold' as const,
      standing: false,
      commentId: null,
    },
  ])(
    'records $scenario only while it stands: $standing',
    async ({ action, standing, commentId }) => {
      if (standing) {
        Object.assign(expectOk(await repositories.comments.findById(COMMENT)) ?? {}, {
          moderationState: 'hidden',
        });
      }

      const result = await run({ action, ...(commentId === null && { commentId }) });

      expect(result.recorded).toBe(standing);
    }
  );

  it.each([
    { scenario: 'a ban that stands', kind: 'ban' as const, recorded: true },
    { scenario: 'a ban that was lifted', kind: null, recorded: false },
    { scenario: 'a shadow ban, which is never told', kind: 'shadow' as const, recorded: false },
  ])('records $scenario: $recorded', async ({ kind, recorded }) => {
    if (kind) {
      expectOk(
        await repositories.channelUserRestrictions.apply({
          channelId: CHANNEL_ID,
          userId: AUTHOR,
          kind,
          reason: 'spam',
          expiresAt: null,
          createdBy: CREATOR_ID,
        })
      );
    }

    const result = await run({ action: 'ban', commentId: null, videoId: null });

    expect(result.recorded).toBe(recorded);
  });
});
