import { createMetricsRegistry, createWatchPartyMetrics } from '@vp/observability';
import { addToTally, emptyTally, publishTally } from '../watch-party-sweep-gauges';
import { reading } from './watch-party-test-deps';

const U1 = '00000000-0000-7000-8000-00000000f001';
const U2 = '00000000-0000-7000-8000-00000000f002';

describe('the sweep gauges', () => {
  it('counts rooms by phase and members by kind, and zeroes what nobody holds', async () => {
    const metrics = createWatchPartyMetrics(createMetricsRegistry().registry);
    metrics.watchPartyRooms.set({ phase: 'finished' }, 9);
    const tally = emptyTally();

    addToTally(tally, { phase: 'playing' }, [
      { memberKey: `user:${U1}`, sinceMs: 1 },
      { memberKey: 'guest:abcdefghijklmnop', sinceMs: 2 },
    ]);
    addToTally(tally, { phase: 'playing' }, [{ memberKey: `user:${U2}`, sinceMs: 3 }]);
    publishTally(tally, metrics);

    expect(await reading(metrics.watchPartyRooms, { phase: 'playing' })).toBe(2);
    expect(await reading(metrics.watchPartyRooms, { phase: 'finished' })).toBe(0);
    expect(await reading(metrics.watchPartyPresentMembers, { kind: 'user' })).toBe(2);
    expect(await reading(metrics.watchPartyPresentMembers, { kind: 'guest' })).toBe(1);
    expect(await reading(metrics.watchPartyPresentMembers, { kind: 'discord' })).toBe(0);
  });
});
