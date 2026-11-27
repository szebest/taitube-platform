import { expectOk } from '@kit/testing/result';
import type { OutboxPayload, OutboxRepository } from '@vp/core/repositories';
import { OUTBOX_MAX_ATTEMPTS } from '@vp/domain-rules';
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

    afterAll(async () => {
      await subject.close();
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

      expect(expectOk(await outbox.recordAttempt(OUTBOX_IDS.first))).toBe('PENDING');
      expect(expectOk(await outbox.findById(OUTBOX_IDS.first))?.attempts).toBe(1);
      expect(expectOk(await outbox.markPublished(OUTBOX_IDS.unknown))).toBe(false);
      expect(expectOk(await outbox.recordAttempt(OUTBOX_IDS.unknown))).toBeNull();
    });

    it.each([
      {
        scenario: 'a record another relay claimed',
        settle: async () => {
          await outbox.claimBatch(10);
        },
      },
      {
        scenario: 'a record whose publish just failed',
        settle: async () => {
          await outbox.recordAttempt(OUTBOX_IDS.first);
        },
      },
    ])('does not claim $scenario again straight away', async ({ settle }) => {
      await outbox.enqueue({ id: OUTBOX_IDS.first, kind: 'first', payload: PAYLOAD });
      await settle();

      expect(expectOk(await outbox.claimBatch(10))).toEqual([]);
    });

    it('buries a record DEAD on its last attempt, and never claims or publishes it again', async () => {
      await outbox.enqueue({ id: OUTBOX_IDS.first, kind: 'first', payload: PAYLOAD });
      const outcomes = [];
      for (let attempt = 1; attempt <= OUTBOX_MAX_ATTEMPTS; attempt += 1) {
        outcomes.push(expectOk(await outbox.recordAttempt(OUTBOX_IDS.first)));
      }

      expect(outcomes.at(-2)).toBe('PENDING');
      expect(outcomes.at(-1)).toBe('DEAD');
      expect(expectOk(await outbox.findById(OUTBOX_IDS.first))?.status).toBe('DEAD');
      expect(expectOk(await outbox.markPublished(OUTBOX_IDS.first))).toBe(false);
      expect(expectOk(await outbox.recordAttempt(OUTBOX_IDS.first))).toBeNull();
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
