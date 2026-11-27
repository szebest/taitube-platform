import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { standardChannelLayout } from '@vp/domain';
import { runPromoteLayoutSchedules } from '../promote-layout-schedules';

const AT = Date.parse('2026-12-10T12:00:00.000Z');
const USER = '00000000-0000-7000-8000-00000000c001';
const CHANNEL = '00000000-0000-7000-8000-00000000c002';

async function schedule(repositories: InMemoryRepositories, n: number, minutesFromAt: number) {
  const id = `00000000-0000-7000-8000-00000000c1${String(n).padStart(2, '0')}`;
  const publishAt = new Date(AT + minutesFromAt * 60_000);
  expectOk(
    await repositories.channelLayoutSchedules.create(
      { id, channelId: CHANNEL, document: standardChannelLayout(), publishAt, createdBy: USER },
      {
        channelId: CHANNEL,
        actorUserId: USER,
        action: 'page.scheduled',
        targetType: 'page',
        targetId: CHANNEL,
        meta: { scheduleId: id, publishAt: publishAt.toISOString() },
      }
    )
  );
}

describe('housekeeping: promote-layout-schedules', () => {
  it('applies the schedules that came due once, however many runs find them', async () => {
    const repositories = new InMemoryRepositories();
    await schedule(repositories, 1, -5);
    await schedule(repositories, 2, 5);
    const run = async () =>
      expectOk(await runPromoteLayoutSchedules({ repositories, now: () => AT, scanLimit: 10 }));

    const results = await Promise.all([run(), run()]);

    expect(results.reduce((sum, result) => sum + result.appliedCount, 0)).toBe(1);
    expect(expectOk(await repositories.channelLayouts.getPublished(CHANNEL))).toMatchObject({
      version: 1,
    });
  });
});
