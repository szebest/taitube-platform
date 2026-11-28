import { expectOk } from '@kit/testing/result';
import { NOTIFY_PARTY_REMINDER } from '@vp/job-contracts';
import { updateRoom } from '../watch-party-settings';
import {
  OWNER,
  seedParty,
  startParty,
  userCaller,
  watchPartyTestDeps,
} from './watch-party-test-deps';

describe('apps/server/api/services: the reminders of an edited room', () => {
  it('queues reminders for a new time only, so a reschedule sends just the new ones', async () => {
    const world = watchPartyTestDeps();
    await seedParty(world);
    const room = await startParty(world, {});
    const at = (minutes: number) => new Date(world.clock.nowMs + minutes * 60_000).toISOString();
    const reminderIds: string[] = [];
    const collect = async () => {
      const claimed = expectOk(await world.repositories.outbox.claimBatch(20));
      for (const { payload } of claimed) {
        if (payload.type === 'queue' && payload.job.name === NOTIFY_PARTY_REMINDER) {
          reminderIds.push(payload.job.opts?.jobId ?? '');
        }
      }
      return reminderIds.length;
    };
    const edit = async (patch: Record<string, unknown>, version: number) =>
      expectOk(await updateRoom(world.deps, room.id, userCaller(OWNER), { version, ...patch }));

    await edit({ scheduledFor: at(60) }, room.version);
    expect(await collect()).toBe(2);
    await edit({ name: 'Renamed' }, room.version + 1);
    expect(await collect()).toBe(2);
    await edit({ scheduledFor: at(120) }, room.version + 2);

    expect(await collect()).toBe(4);
    expect(new Set(reminderIds).size).toBe(4);
  });
});
