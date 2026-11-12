import type { DlqRepository } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { VIDEO_IDS, idsOf, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const REPLAY = { from: ['PARKED'], to: 'REPLAYED' } as const;
const DISCARD = { from: ['PARKED'], to: 'DISCARDED' } as const;
const REPLAY_JOB = { type: 'queue', queueName: 'probe', job: { name: 'probe', data: {} } } as const;

const DLQ_IDS = {
  first: '00000000-0000-7000-8000-000000000801',
  second: '00000000-0000-7000-8000-000000000802',
  unknown: '00000000-0000-7000-8000-0000000008ff',
} as const;

export function describeDlqRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('DlqRepository contract', () => {
    let subject: RepositoriesSubject;
    let dlq: DlqRepository;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      dlq = subject.repositories.dlq;
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));

      await dlq.create({
        id: DLQ_IDS.first,
        queue: 'probe',
        jobId: `${VIDEO_IDS.a}--probe`,
        videoId: VIDEO_IDS.a,
        payload: { videoId: VIDEO_IDS.a },
        errorCode: 'CORRUPT_CONTAINER',
        errorMessage: 'ffprobe exited 1',
        attemptsMade: 3,
        workerId: 'worker-1',
      });
      await dlq.create({
        id: DLQ_IDS.second,
        queue: 'transcode',
        jobId: `${VIDEO_IDS.a}--transcode`,
        videoId: VIDEO_IDS.a,
        payload: {},
        attemptsMade: 5,
      });
    });

    it('parks a new entry by default', async () => {
      expect(expectOk(await dlq.findById(DLQ_IDS.first))).toMatchObject({
        queue: 'probe',
        errorCode: 'CORRUPT_CONTAINER',
        attemptsMade: 3,
        workerId: 'worker-1',
        status: 'PARKED',
        replayedAt: null,
      });
      expect(expectOk(await dlq.findById(DLQ_IDS.unknown))).toBeNull();
    });

    it('lists the entries newest first', async () => {
      expect(idsOf(expectOk(await dlq.list({ limit: 10 })))).toEqual([
        DLQ_IDS.second,
        DLQ_IDS.first,
      ]);
    });

    it.each([
      { status: 'REPLAYED' as const, expected: [DLQ_IDS.first] },
      { status: 'PARKED' as const, expected: [DLQ_IDS.second] },
    ])('filters the listing down to $status entries', async ({ status, expected }) => {
      await dlq.transition({ ...REPLAY, id: DLQ_IDS.first, replayedAt: new Date() });

      expect(idsOf(expectOk(await dlq.list({ limit: 10, status })))).toEqual(expected);
    });

    it('over-fetches one row so the caller can detect a next page', async () => {
      const window = expectOk(await dlq.list({ limit: 1 }));
      expect(idsOf(window)).toEqual([DLQ_IDS.second, DLQ_IDS.first]);

      const page = window.slice(0, 1);
      const last = page[page.length - 1];
      const next = expectOk(
        await dlq.list({
          limit: 1,
          ...(last ? { cursor: { createdAt: last.createdAt, id: last.id } } : {}),
        })
      );

      expect(idsOf(next)).toEqual([DLQ_IDS.first]);
    });

    it('moves a parked entry and reports an unknown entry as null', async () => {
      const replayedAt = new Date();
      const updated = expectOk(await dlq.transition({ ...REPLAY, id: DLQ_IDS.first, replayedAt }));

      expect(updated?.status).toBe('REPLAYED');
      expect(updated?.replayedAt).not.toBeNull();
      expect(expectOk(await dlq.transition({ ...DISCARD, id: DLQ_IDS.unknown }))).toBeNull();
    });

    it.each([
      { name: 'replay', edge: REPLAY },
      { name: 'discard', edge: DISCARD },
    ])('refuses to $name an entry that already moved, writing no outbox row', async ({ edge }) => {
      await dlq.transition({ ...REPLAY, id: DLQ_IDS.first });
      const outboxId = '00000000-0000-7000-8000-000000000804';

      const moved = await dlq.transition({
        ...edge,
        id: DLQ_IDS.first,
        outbox: { id: outboxId, kind: 'dlq_replay', payload: REPLAY_JOB },
      });

      expect(expectOk(moved)).toBeNull();
      expect(expectOk(await dlq.findById(DLQ_IDS.first))?.status).toBe('REPLAYED');
      expect(expectOk(await subject.repositories.outbox.findById(outboxId))).toBeNull();
    });

    it('lets one of two concurrent replays win', async () => {
      const moves = await Promise.all([
        dlq.transition({ ...REPLAY, id: DLQ_IDS.first }),
        dlq.transition({ ...REPLAY, id: DLQ_IDS.first }),
      ]);

      expect(moves.map((move) => expectOk(move) !== null).sort()).toEqual([false, true]);
    });

    it('writes the outbox row in the same call when one is supplied', async () => {
      const outboxId = '00000000-0000-7000-8000-000000000803';
      await dlq.transition({
        ...REPLAY,
        id: DLQ_IDS.first,
        replayedAt: new Date(),
        outbox: { id: outboxId, kind: 'job.enqueue', payload: REPLAY_JOB },
      });

      expect(expectOk(await subject.repositories.outbox.findById(outboxId))).toMatchObject({
        kind: 'job.enqueue',
      });
    });
  });
}
