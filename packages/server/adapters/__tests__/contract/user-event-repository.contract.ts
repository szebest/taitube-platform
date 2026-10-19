import type { NewUserEventInput, UserEventRepository } from '@vp/core/repositories';
import { userChannel } from '@vp/events';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

function statusEvent(overrides: Partial<NewUserEventInput> = {}): NewUserEventInput {
  return {
    userId: OWNER_ID,
    type: 'video.processing',
    payload: { videoId: VIDEO_IDS.a, change: { kind: 'status', status: 'READY' } },
    ...overrides,
  };
}

export function describeUserEventRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('UserEventRepository contract', () => {
    let subject: RepositoriesSubject;
    let userEvents: UserEventRepository;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      userEvents = subject.repositories.userEvents;
    });

    it('appends with a monotonic id and publishes the framed event through the outbox', async () => {
      const first = expectOk(await userEvents.append(statusEvent()));
      const second = expectOk(await userEvents.append(statusEvent()));

      expect(second.id).toBeGreaterThan(first.id);
      expect(expectOk(await subject.repositories.outbox.claimBatch(10))[1]?.payload).toEqual({
        type: 'pubsub',
        channel: userChannel(OWNER_ID),
        message: JSON.stringify({ id: second.id, type: second.type, payload: second.payload }),
      });
    });

    it('lists one user from the given id on, oldest first, up to the limit', async () => {
      const from = expectOk(await userEvents.append(statusEvent()));
      await userEvents.append(statusEvent({ userId: OTHER_OWNER_ID }));
      const next = expectOk(await userEvents.append(statusEvent()));
      await userEvents.append(statusEvent());

      const listed = expectOk(await userEvents.listFrom(OWNER_ID, from.id, 2));

      expect(listed.map((event) => event.id)).toEqual([from.id, next.id]);
      expect(listed[1]).toMatchObject({ userId: OWNER_ID, payload: statusEvent().payload });
    });

    it.each([
      ['keeps events inside the retention window', 7, 1],
      ['prunes events past it', -1, 0],
    ])('%s', async (_label, retentionDays, left) => {
      const kept = expectOk(await userEvents.append(statusEvent()));

      expect(expectOk(await userEvents.prune(retentionDays))).toBe(1 - left);
      expect(expectOk(await userEvents.listFrom(OWNER_ID, kept.id, 10))).toHaveLength(left);
    });
  });
}
