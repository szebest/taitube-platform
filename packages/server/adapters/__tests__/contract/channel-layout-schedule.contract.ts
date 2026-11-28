import { expectOk } from '@kit/testing/result';
import { standardChannelLayout, type NewChannelAuditEntry } from '@vp/domain';
import { OTHER_OWNER_CHANNEL_ID, OWNER_CHANNEL_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const SCHEDULE_IDS = {
  soon: '00000000-0000-7000-8000-0000000000e1',
  later: '00000000-0000-7000-8000-0000000000e2',
} as const;

const NOW = new Date('2026-12-01T12:00:00.000Z');

const scheduleAudit = (action: 'page.scheduled' | 'page.schedule_cancelled', id: string) =>
  ({
    channelId: OWNER_CHANNEL_ID,
    actorUserId: OWNER_ID,
    action,
    targetType: 'page',
    targetId: OWNER_CHANNEL_ID,
    meta: { scheduleId: id, publishAt: NOW.toISOString() },
  }) satisfies NewChannelAuditEntry;

export function describeChannelLayoutScheduleContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelLayoutScheduleRepository contract', () => {
    let subject: RepositoriesSubject;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
    });

    const queue = async (id: string, publishAt: Date) =>
      expectOk(
        await subject.repositories.channelLayoutSchedules.create(
          {
            id,
            channelId: OWNER_CHANNEL_ID,
            document: standardChannelLayout(),
            publishAt,
            createdBy: OWNER_ID,
          },
          scheduleAudit('page.scheduled', id)
        )
      );

    it('applies a due schedule once however often the scheduler runs', async () => {
      const { channelLayoutSchedules, channelLayouts } = subject.repositories;
      await queue(SCHEDULE_IDS.soon, new Date(NOW.getTime() - 1000));
      await queue(SCHEDULE_IDS.later, new Date(NOW.getTime() + 3_600_000));

      const [first, second] = await Promise.all([
        channelLayoutSchedules.promoteDue(NOW, 10),
        channelLayoutSchedules.promoteDue(NOW, 10),
      ]);

      const applied = [expectOk(first), expectOk(second)].flat();
      expect(applied).toEqual([SCHEDULE_IDS.soon]);
      expect(expectOk(await channelLayouts.getPublished(OWNER_CHANNEL_ID))).toMatchObject({
        version: 1,
        authorUserId: OWNER_ID,
      });
      expect(
        expectOk(await channelLayoutSchedules.listPending(OWNER_CHANNEL_ID)).map(({ id }) => id)
      ).toEqual([SCHEDULE_IDS.later]);
    });

    it('cancels a pending schedule of its own channel only, and only once', async () => {
      const { channelLayoutSchedules } = subject.repositories;
      await queue(SCHEDULE_IDS.later, new Date(NOW.getTime() + 3_600_000));
      const cancel = async (channelId: string) =>
        expectOk(
          await channelLayoutSchedules.cancel(
            channelId,
            SCHEDULE_IDS.later,
            scheduleAudit('page.schedule_cancelled', SCHEDULE_IDS.later)
          )
        );

      expect(await cancel(OTHER_OWNER_CHANNEL_ID)).toBeNull();
      expect(await cancel(OWNER_CHANNEL_ID)).toMatchObject({ status: 'cancelled' });
      expect(await cancel(OWNER_CHANNEL_ID)).toBeNull();
      expect(expectOk(await channelLayoutSchedules.promoteDue(new Date('2027-01-01'), 10))).toEqual(
        []
      );
    });
  });
}
