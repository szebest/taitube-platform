import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { CHANNEL_AUDIT_RETENTION_DAYS } from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { expectOk } from '@vp/testing/result';
import { runPurgeChannelAudit } from '../purge-channel-audit';

const CHANNEL_ID = '00000000-0000-7000-8000-00000000c001';
const USER_ID = '00000000-0000-7000-8000-00000000a001';

describe('housekeeping: purge-channel-audit', () => {
  let repositories: InMemoryRepositories;

  const purgeAfter = (days: number) =>
    runPurgeChannelAudit({
      repositories,
      retentionDays: CHANNEL_AUDIT_RETENTION_DAYS,
      now: () => Date.now() + days * MS_PER_DAY,
    });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    expectOk(
      await repositories.channelAudit.append({
        channelId: CHANNEL_ID,
        actorUserId: USER_ID,
        action: 'member.left',
        targetType: 'member',
        targetId: USER_ID,
        meta: { role: 'editor' },
      })
    );
  });

  it.each([
    { scenario: 'keeps a row inside the 365 days', days: 364, purgedCount: 0 },
    { scenario: 'deletes a row older than 365 days', days: 366, purgedCount: 1 },
  ])('$scenario', async ({ days, purgedCount }) => {
    expect(expectOk(await purgeAfter(days))).toEqual({ purgedCount });
  });
});
