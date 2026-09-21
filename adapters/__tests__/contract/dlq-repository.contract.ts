import type { DlqRepository } from '@vp/core/ports';
import { VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

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
        errorCode: 'PROBE_FAILED',
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
      expect(await dlq.findById(DLQ_IDS.first)).toMatchObject({
        queue: 'probe',
        errorCode: 'PROBE_FAILED',
        attemptsMade: 3,
        workerId: 'worker-1',
        status: 'PARKED',
        replayedAt: null,
      });
      expect(await dlq.findById(DLQ_IDS.unknown)).toBeNull();
    });

    it('lists the entries newest first', async () => {
      const { items } = await dlq.list();
      expect(items.map((e) => e.id)).toEqual([DLQ_IDS.second, DLQ_IDS.first]);
    });

    it('filters the listing by status', async () => {
      await dlq.updateStatus(DLQ_IDS.first, 'REPLAYED', { replayedAt: new Date() });

      expect((await dlq.list({ status: 'REPLAYED' })).items.map((e) => e.id)).toEqual([
        DLQ_IDS.first,
      ]);
      expect((await dlq.list({ status: 'PARKED' })).items.map((e) => e.id)).toEqual([
        DLQ_IDS.second,
      ]);
    });

    it('mints a next cursor only when a further page exists', async () => {
      const firstPage = await dlq.list({ limit: 1 });
      expect(firstPage.items).toHaveLength(1);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await dlq.list({ limit: 1, cursor: firstPage.nextCursor ?? undefined });
      expect(secondPage.items.map((e) => e.id)).toEqual([DLQ_IDS.first]);
      expect(secondPage.nextCursor).toBeNull();
    });

    it('updates the status and reports an unknown entry as null', async () => {
      const replayedAt = new Date();
      const updated = await dlq.updateStatus(DLQ_IDS.first, 'REPLAYED', { replayedAt });

      expect(updated?.status).toBe('REPLAYED');
      expect(updated?.replayedAt).not.toBeNull();
      expect(await dlq.updateStatus(DLQ_IDS.unknown, 'DISCARDED')).toBeNull();
    });

    it('writes the outbox row in the same call when one is supplied', async () => {
      const outboxId = '00000000-0000-7000-8000-000000000803';
      await dlq.updateStatus(
        DLQ_IDS.first,
        'REPLAYED',
        { replayedAt: new Date() },
        {
          id: outboxId,
          kind: 'job.enqueue',
          payload: { type: 'queue', queueName: 'probe', job: { name: 'probe', data: {} } },
        }
      );

      expect(await subject.repositories.outbox.findById(outboxId)).toMatchObject({
        kind: 'job.enqueue',
      });
    });
  });
}
