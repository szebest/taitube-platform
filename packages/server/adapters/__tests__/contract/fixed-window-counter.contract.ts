import { randomUUID } from 'node:crypto';
import { expectOk } from '@kit/testing/result';
import type { FixedWindowCounterPort } from '@vp/core/ports';

export interface FixedWindowCounterSubject {
  readonly counter: FixedWindowCounterPort;
  /** A counter over the same store, as a restarted process would open it. */
  restarted(): Promise<FixedWindowCounterPort>;
  close(): Promise<void>;
}

const WINDOW_MS = 60_000;

export function describeFixedWindowCounterContract(
  makeSubject: () => Promise<FixedWindowCounterSubject>
) {
  describe('FixedWindowCounter contract', () => {
    let subject: FixedWindowCounterSubject;
    let key: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      key = randomUUID();
    });

    const hit = async (counter = subject.counter, scope = key) =>
      expectOk(await counter.hit(scope, WINDOW_MS));

    it('counts each hit of a key in its window and says when the window closes', async () => {
      const counts = [(await hit()).count, (await hit()).count, (await hit()).count];
      const { resetInMs } = await hit();

      expect(counts).toEqual([1, 2, 3]);
      expect(resetInMs).toBeGreaterThan(0);
      expect(resetInMs).toBeLessThanOrEqual(WINDOW_MS);
    });

    it('counts each key on its own', async () => {
      await hit();
      await hit();

      expect((await hit(subject.counter, randomUUID())).count).toBe(1);
    });

    it('keeps the count across a restart inside the window', async () => {
      await hit();
      await hit();

      const afterRestart = await subject.restarted();

      expect((await hit(afterRestart)).count).toBe(3);
    });
  });
}
