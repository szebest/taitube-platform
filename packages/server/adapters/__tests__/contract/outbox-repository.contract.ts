import type { OutboxPayload, OutboxRepository } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const OUTBOX_IDS = {
  first: '00000000-0000-7000-8000-000000000701',
  second: '00000000-0000-7000-8000-000000000702',
  unknown: '00000000-0000-7000-8000-0000000007ff',
} as const;

const PAYLOAD: OutboxPayload = {
  type: 'queue',
  queueName: 'probe',
  job: { name: 'probe', data: { videoId: 'v1' } },
};

export function describeOutboxRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('OutboxRepository contract', () => {
    let subject: RepositoriesSubject;
    let outbox: OutboxRepository;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    beforeEach(async () => {
      await subject.reset();
      outbox = subject.repositories.outbox;
    });

    it('enqueues an unpublished record with a zero attempt count', async () => {
      const record = expectOk(
        await outbox.enqueue({
          id: OUTBOX_IDS.first,
          kind: 'job.enqueue',
          payload: PAYLOAD,
        })
      );

      expect(record).toMatchObject({ kind: 'job.enqueue', publishedAt: null, attempts: 0 });
      expect(expectOk(await outbox.findById(OUTBOX_IDS.first))).toMatchObject({
        kind: 'job.enqueue',
      });
      expect(expectOk(await outbox.findById(OUTBOX_IDS.unknown))).toBeNull();
    });

    it('claims only unpublished records, oldest first, up to the limit', async () => {
      await outbox.enqueue({ id: OUTBOX_IDS.first, kind: 'first', payload: PAYLOAD });
      await outbox.enqueue({ id: OUTBOX_IDS.second, kind: 'second', payload: PAYLOAD });

      expect(expectOk(await outbox.claimBatch(1)).map((r) => r.kind)).toEqual(['first']);

      await outbox.markPublished(OUTBOX_IDS.first);
      expect(expectOk(await outbox.claimBatch(10)).map((r) => r.kind)).toEqual(['second']);
    });

    it('reports a missing record on publish and attempt bookkeeping', async () => {
      await outbox.enqueue({ id: OUTBOX_IDS.first, kind: 'first', payload: PAYLOAD });

      expect(expectOk(await outbox.recordAttempt(OUTBOX_IDS.first))).toBe(true);
      expect(expectOk(await outbox.findById(OUTBOX_IDS.first))?.attempts).toBe(1);
      expect(expectOk(await outbox.markPublished(OUTBOX_IDS.unknown))).toBe(false);
      expect(expectOk(await outbox.recordAttempt(OUTBOX_IDS.unknown))).toBe(false);
    });

    it('prunes nothing while the published records are inside the retention window', async () => {
      await outbox.enqueue({ id: OUTBOX_IDS.first, kind: 'first', payload: PAYLOAD });
      await outbox.markPublished(OUTBOX_IDS.first);

      expect(expectOk(await outbox.prune(7))).toBe(0);
      expect(expectOk(await outbox.findById(OUTBOX_IDS.first))).not.toBeNull();
    });

    it('prunes the published records once the retention window has passed', async () => {
      await outbox.enqueue({ id: OUTBOX_IDS.first, kind: 'first', payload: PAYLOAD });
      await outbox.enqueue({ id: OUTBOX_IDS.second, kind: 'second', payload: PAYLOAD });
      await outbox.markPublished(OUTBOX_IDS.first);

      expect(expectOk(await outbox.prune(-1))).toBe(1);
      expect(expectOk(await outbox.findById(OUTBOX_IDS.first))).toBeNull();
      expect(expectOk(await outbox.findById(OUTBOX_IDS.second))).not.toBeNull();
    });
  });
}
