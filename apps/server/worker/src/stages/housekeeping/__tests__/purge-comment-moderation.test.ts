import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { MS_PER_DAY } from '@vp/domain/time';
import { expectOk } from '@vp/testing/result';
import { runPurgeCommentModeration } from '../purge-comment-moderation';

const CHANNEL_ID = '00000000-0000-7000-8000-00000000c001';
const USER_ID = '00000000-0000-7000-8000-00000000a001';
const OTHER_ID = '00000000-0000-7000-8000-00000000a002';

describe('housekeeping: purge-comment-moderation', () => {
  let repositories: InMemoryRepositories;

  const purgeAfter = (days: number) =>
    runPurgeCommentModeration({ repositories, now: () => Date.now() + days * MS_PER_DAY });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    const ended = (userId: string, kind: 'ban' | 'shadow') => ({
      channelId: CHANNEL_ID,
      userId,
      kind,
      reason: null,
      expiresAt: kind === 'ban' ? new Date(Date.now() - MS_PER_DAY) : null,
      createdBy: null,
    });
    expectOk(await repositories.channelUserRestrictions.apply(ended(USER_ID, 'ban')));
    expectOk(await repositories.channelUserRestrictions.apply(ended(OTHER_ID, 'shadow')));
    repositories.comments.removals.set(USER_ID, {
      id: USER_ID,
      channelId: CHANNEL_ID,
      videoId: CHANNEL_ID,
      authorId: USER_ID,
      excerpt: 'hello',
      reason: 'spam',
      note: null,
      disclosure: 'visible',
      removedBy: null,
      createdAt: new Date(),
    });
  });

  it.each([
    { scenario: 'keeps everything inside 30 days', days: 20, removals: 0, restrictions: 0 },
    {
      scenario:
        'purges a removal past 30 days and a ban that ended more than 30 days ago, never a shadow ban',
      days: 40,
      removals: 1,
      restrictions: 1,
    },
  ])('$scenario', async ({ days, removals, restrictions }) => {
    expect(expectOk(await purgeAfter(days))).toEqual({ removals, restrictions });
  });
});
