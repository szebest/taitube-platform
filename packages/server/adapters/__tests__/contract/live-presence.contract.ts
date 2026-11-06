import { randomUUID } from 'node:crypto';
import type { LivePresencePort } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface LivePresenceSubject {
  readonly presence: LivePresencePort;
  close(): Promise<void>;
}

export function describeLivePresenceContract(makeSubject: () => Promise<LivePresenceSubject>) {
  describe('LivePresence contract', () => {
    let subject: LivePresenceSubject;
    let streamId: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      streamId = randomUUID();
    });

    const count = async (sinceMs: number) =>
      expectOk(await subject.presence.count(streamId, sinceMs));

    it('counts each viewer once, and forgets one that left', async () => {
      expectOk(await subject.presence.touch(streamId, ['a', 'b'], 1_000));
      expectOk(await subject.presence.touch(streamId, ['a'], 2_000));
      expect(await count(0)).toBe(2);

      expectOk(await subject.presence.leave(streamId, 'b'));
      expect(await count(0)).toBe(1);
    });

    it('stops counting a viewer whose last touch is older than the window', async () => {
      expectOk(await subject.presence.touch(streamId, ['stale'], 1_000));
      expectOk(await subject.presence.touch(streamId, ['fresh'], 5_000));

      expect(await count(5_000)).toBe(1);
    });
  });
}
