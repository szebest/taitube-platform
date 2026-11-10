import { randomUUID } from 'node:crypto';
import type { WatchPartyPresencePort } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface WatchPartyPresenceSubject {
  readonly presence: WatchPartyPresencePort;
  close(): Promise<void>;
}

const NOW = 100_000;
const FRESH = NOW - 45_000;

export function describeWatchPartyPresenceContract(
  makeSubject: () => Promise<WatchPartyPresenceSubject>
) {
  describe('WatchPartyPresence contract', () => {
    let subject: WatchPartyPresenceSubject;
    let roomId: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(() => {
      roomId = randomUUID();
    });

    const admit = async (
      memberKey: string,
      limit: number | null,
      { nowMs = NOW, staleBeforeMs = FRESH } = {}
    ) => expectOk(await subject.presence.admit(roomId, memberKey, { limit, nowMs, staleBeforeMs }));
    const members = async (staleBeforeMs = FRESH) =>
      expectOk(await subject.presence.members(roomId, staleBeforeMs));

    it('admits up to the limit and answers full past it, counting who is present', async () => {
      expect(await admit('user:a', 2)).toEqual({ type: 'admitted', present: 1 });
      expect(await admit('user:b', 2)).toEqual({ type: 'admitted', present: 2 });
      expect(await admit('user:c', 2)).toEqual({ type: 'full', present: 2 });
    });

    it('admits exactly one of two members racing for the last spot', async () => {
      await admit('user:a', 2);

      const outcomes = await Promise.all([admit('user:b', 2), admit('user:c', 2)]);

      expect(outcomes.map(({ type }) => type).sort()).toEqual(['admitted', 'full']);
      expect(await members()).toHaveLength(2);
    });

    it('admits a member already present again when the room is full', async () => {
      await admit('user:a', 1);

      expect(await admit('user:a', 1)).toEqual({ type: 'admitted', present: 1 });
      expect(await admit('user:b', 1)).toEqual({ type: 'full', present: 1 });
    });

    it('admits past any count when there is no limit', async () => {
      await admit('user:a', 2);
      await admit('user:b', 2);
      expect(await admit('user:c', 2)).toMatchObject({ type: 'full' });

      expect(await admit('user:owner', null)).toEqual({ type: 'admitted', present: 3 });
    });

    it('prunes entries last touched before the cutoff, which frees their spots', async () => {
      await admit('user:old', 2, { nowMs: 10_000, staleBeforeMs: 0 });
      await admit('user:fresh', 2, { nowMs: NOW - 1_000, staleBeforeMs: 0 });
      expect(await admit('user:blocked', 2, { staleBeforeMs: 0 })).toEqual({
        type: 'full',
        present: 2,
      });

      expect(await admit('user:new', 2)).toEqual({ type: 'admitted', present: 2 });
      expect((await members()).map(({ memberKey }) => memberKey)).toEqual([
        'user:fresh',
        'user:new',
      ]);
    });

    it('keeps the first presence time through a re-admit and a touch, and starts again after a leave', async () => {
      await admit('user:a', null, { nowMs: 1_000, staleBeforeMs: 0 });
      await admit('user:a', null, { nowMs: 2_000, staleBeforeMs: 0 });
      expectOk(await subject.presence.touch(roomId, ['user:a'], 3_000));
      expect(await members(0)).toEqual([{ memberKey: 'user:a', sinceMs: 1_000 }]);

      expectOk(await subject.presence.leave(roomId, 'user:a'));
      await admit('user:a', null, { nowMs: 4_000, staleBeforeMs: 0 });

      expect(await members(0)).toEqual([{ memberKey: 'user:a', sinceMs: 4_000 }]);
    });

    it('lists the longest present first, and drops one that has not been touched since the cutoff', async () => {
      await admit('user:late', null, { nowMs: 90_000 });
      await admit('user:early', null, { nowMs: 80_000 });
      await admit('user:gone', null, { nowMs: 10_000 });
      expectOk(await subject.presence.touch(roomId, ['user:late', 'user:early'], NOW));

      expect(await members()).toEqual([
        { memberKey: 'user:early', sinceMs: 80_000 },
        { memberKey: 'user:late', sinceMs: 90_000 },
      ]);
    });

    it('stops listing a member who left, and frees the spot', async () => {
      await admit('user:a', 1);

      expectOk(await subject.presence.leave(roomId, 'user:a'));

      expect(await members()).toEqual([]);
      expect(await admit('user:b', 1)).toEqual({ type: 'admitted', present: 1 });
    });
  });
}
