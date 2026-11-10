import { SCREENING_TRANSITIONS, VIDEO_STATUSES, type VideoStatus } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import { describeScreeningCases } from './screening-cases.contract';
import { APPEAL_ID, MODERATOR_A, MODERATOR_B, SCREENING_ID, screening } from './screening-fixtures';
import { describeScreeningResults } from './screening-results.contract';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const EDGES = Object.entries(SCREENING_TRANSITIONS).flatMap(([name, edge]) =>
  VIDEO_STATUSES.map((status) => ({
    name: name as keyof typeof SCREENING_TRANSITIONS,
    from: edge.from,
    to: edge.to,
    status,
    legal: status === edge.from,
  }))
);

export function describeScreeningRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ScreeningRepository contract', () => {
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
      await subject.repositories.users.upsert({
        id: MODERATOR_B,
        email: 'moderator-b@video-pipeline.local',
      });
    });

    describeScreeningResults(() => subject);
    describeScreeningCases(() => subject);

    const screenings = () => subject.repositories.screenings;
    const videoIn = async (status: VideoStatus, errorCode?: string) => {
      await subject.seedVideo({
        ...publicVideo({ id: VIDEO_IDS.a, status }),
        ...(errorCode ? { errorCode: errorCode as typeof ErrorCodes.SCREENING_REJECTED } : {}),
      });
      expectOk(await screenings().record(screening()));
    };
    const statusOf = async () =>
      expectOk(await subject.repositories.videos.findById(VIDEO_IDS.a))?.status;
    const eventTypes = async () =>
      expectOk(await subject.repositories.events.findByVideoId(VIDEO_IDS.a)).map(
        (event) => event.type
      );
    const approve = (moderatorId = MODERATOR_A) =>
      screenings().approve({ videoId: VIDEO_IDS.a, moderatorId });
    const reject = (moderatorId = MODERATOR_A) =>
      screenings().reject({
        videoId: VIDEO_IDS.a,
        moderatorId,
        reason: 'Re-upload of a taken-down video',
      });
    const appeal = () =>
      screenings().appeal({
        id: APPEAL_ID,
        videoId: VIDEO_IDS.a,
        authorId: OWNER_ID,
        message: 'This is my own footage',
      });
    const edgeCalls = {
      hold: () => screenings().hold({ videoId: VIDEO_IDS.a }),
      approve: () => approve(),
      reject: () => reject(),
      appeal: () => appeal(),
    };

    it.each(EDGES)(
      '$name from $status: committed $legal, and it only moves $from to $to',
      async ({ name, from, to, status, legal }) => {
        await videoIn(status, from === 'REJECTED' ? ErrorCodes.SCREENING_REJECTED : undefined);

        expect(expectOk(await edgeCalls[name]())).toBe(legal);

        expect(await statusOf()).toBe(legal ? to : status);
        expect(await eventTypes()).toEqual(legal ? [SCREENING_TRANSITIONS[name].event] : []);
      }
    );

    it('refuses an appeal of a manual takedown and opens no appeal', async () => {
      await videoIn('REJECTED');

      expect(expectOk(await appeal())).toBe(false);
      expect(await statusOf()).toBe('REJECTED');
      expect(expectOk(await screenings().findAppeals(VIDEO_IDS.a))).toEqual([]);
    });

    it('refuses an appeal of a screening rejection that has no stored result', async () => {
      await subject.seedVideo({
        ...publicVideo({ id: VIDEO_IDS.a, status: 'REJECTED' }),
        errorCode: ErrorCodes.SCREENING_REJECTED,
      });

      expect(expectOk(await appeal())).toBe(false);
      expect(await statusOf()).toBe('REJECTED');
    });

    it('lets the first moderator win and writes nothing for the stale second', async () => {
      await videoIn('HELD');

      expect(expectOk(await approve(MODERATOR_A))).toBe(true);
      expect(expectOk(await approve(MODERATOR_B))).toBe(false);
      expect(expectOk(await reject(MODERATOR_B))).toBe(false);

      expect(await statusOf()).toBe('PROCESSING');
      expect(await eventTypes()).toEqual(['video.screening_approved']);
      expect(expectOk(await screenings().latestForVideo(VIDEO_IDS.a))).toMatchObject({
        decision: 'approved',
        decidedBy: MODERATOR_A,
      });
    });

    it('commits exactly one of an approve and a reject racing for the same video', async () => {
      await videoIn('HELD');

      const outcomes = await Promise.all([approve(MODERATOR_A), reject(MODERATOR_B)]);

      expect(outcomes.map((outcome) => expectOk(outcome)).sort()).toEqual([false, true]);
      expect(await eventTypes()).toHaveLength(1);
    });

    it('records the hold with the reasons it was held for and tells the owner', async () => {
      await videoIn('PROCESSING');
      await screenings().hold({ videoId: VIDEO_IDS.a });

      const [held] = expectOk(await subject.repositories.events.findByVideoId(VIDEO_IDS.a));
      const announced = expectOk(
        await subject.repositories.userEvents.listFrom(OWNER_ID, 0, 10)
      ).map((event) => event.payload);

      expect(held?.payload).toEqual({ screeningId: SCREENING_ID, reasons: ['DUPLICATE'] });
      expect(announced).toMatchObject([
        { videoId: VIDEO_IDS.a, change: { kind: 'status', status: 'HELD' } },
      ]);
    });

    it('rejects with the screening marker, the reason and who decided', async () => {
      await videoIn('HELD');
      await reject(MODERATOR_A);

      expect(expectOk(await subject.repositories.videos.findById(VIDEO_IDS.a))).toMatchObject({
        status: 'REJECTED',
        errorCode: ErrorCodes.SCREENING_REJECTED,
      });
      expect(expectOk(await screenings().latestForVideo(VIDEO_IDS.a))).toMatchObject({
        decision: 'rejected',
        decidedBy: MODERATOR_A,
        decisionNote: 'Re-upload of a taken-down video',
      });
    });

    it('takes an appeal back into the queue, then resolves it when the other moderator decides', async () => {
      await videoIn('HELD');
      await reject(MODERATOR_A);

      expect(expectOk(await appeal())).toBe(true);
      expect(expectOk(await subject.repositories.videos.findById(VIDEO_IDS.a))).toMatchObject({
        status: 'HELD',
        errorCode: null,
      });
      expect(expectOk(await screenings().latestForVideo(VIDEO_IDS.a))).toMatchObject({
        decision: null,
        decidedBy: null,
      });
      expect(expectOk(await screenings().findAppeals(VIDEO_IDS.a))).toMatchObject([
        { id: APPEAL_ID, screeningId: SCREENING_ID, rejectedBy: MODERATOR_A, resolvedAt: null },
      ]);

      expect(expectOk(await approve(MODERATOR_B))).toBe(true);

      expect(expectOk(await screenings().findAppeals(VIDEO_IDS.a))).toMatchObject([
        { resolvedBy: MODERATOR_B },
      ]);
      expect(await eventTypes()).toEqual([
        'video.screening_rejected',
        'video.screening_appealed',
        'video.screening_approved',
      ]);
    });

    it('enqueues the package job with the approval, and not for a stale one', async () => {
      await videoIn('HELD');
      const outbox = {
        id: '00000000-0000-7000-8000-0000000005c1',
        kind: 'queue',
        payload: {
          type: 'queue' as const,
          queueName: 'package',
          job: { name: 'package', data: { videoId: VIDEO_IDS.a } },
        },
      };

      await screenings().approve({ videoId: VIDEO_IDS.a, moderatorId: MODERATOR_A, outbox });
      const queued = expectOk(await subject.repositories.outbox.findById(outbox.id));

      expect(queued?.payload).toEqual(outbox.payload);
    });

    it('forgets everything on clear and reset', async () => {
      await videoIn('HELD');
      await subject.reset();

      expect(expectOk(await screenings().latestForVideo(VIDEO_IDS.a))).toBeNull();
    });
  });
}
