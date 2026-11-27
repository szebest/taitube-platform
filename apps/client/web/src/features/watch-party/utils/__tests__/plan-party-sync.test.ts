import type { WatchPartyPlayback } from '@vp/domain';
import { type PartySyncInput, planPartySync } from '../plan-party-sync';

const PLAYING: WatchPartyPlayback = {
  itemId: 'item-1',
  phase: 'playing',
  positionMs: 10_000,
  rate: 1,
  anchorAt: 1_000,
};

function input(overrides: Partial<PartySyncInput> = {}): PartySyncInput {
  return {
    playback: PLAYING,
    serverNow: 6_000,
    now: 6_000,
    player: { paused: false, buffering: false, positionMs: 15_000, rate: 1 },
    cooldownUntil: 0,
    playRefused: false,
    ...overrides,
  };
}

describe('apps/client/web: planPartySync', () => {
  it.each([
    {
      scenario: 'nothing when the player is on the room clock',
      overrides: {},
      steps: [],
    },
    {
      scenario: 'a slower rate when the player is a little ahead',
      overrides: { player: { paused: false, buffering: false, positionMs: 15_600, rate: 1 } },
      steps: [{ type: 'rate', rate: 0.95 }],
    },
    {
      scenario: 'a faster rate when the player is a little behind',
      overrides: { player: { paused: false, buffering: false, positionMs: 14_400, rate: 1 } },
      steps: [{ type: 'rate', rate: 1.05 }],
    },
    {
      scenario: 'the room rate again once a nudged player has caught up',
      overrides: { player: { paused: false, buffering: false, positionMs: 15_050, rate: 1.05 } },
      steps: [{ type: 'rate', rate: 1 }],
    },
    {
      scenario: 'a seek to the room position when the player is far off',
      overrides: { player: { paused: false, buffering: false, positionMs: 30_000, rate: 1 } },
      steps: [{ type: 'seek', positionMs: 15_000 }],
    },
    {
      scenario: 'play when the room plays and the player is paused',
      overrides: { player: { paused: true, buffering: false, positionMs: 15_000, rate: 1 } },
      steps: [{ type: 'play' }],
    },
    {
      scenario: 'mute then play when the browser refused the first play',
      overrides: {
        player: { paused: true, buffering: false, positionMs: 15_000, rate: 1 },
        playRefused: true,
      },
      steps: [{ type: 'mute' }, { type: 'play' }],
    },
    {
      scenario: 'no correction while the player buffers',
      overrides: { player: { paused: false, buffering: true, positionMs: 30_000, rate: 1 } },
      steps: [],
    },
    {
      scenario: 'no seek inside the cooldown of the last one',
      overrides: {
        player: { paused: false, buffering: false, positionMs: 30_000, rate: 1 },
        cooldownUntil: 9_000,
      },
      steps: [],
    },
  ])('plans $scenario', ({ overrides, steps }) => {
    expect(planPartySync(input(overrides)).steps).toEqual(steps);
  });

  it('starts the cooldown and counts a hard seek', () => {
    const plan = planPartySync(
      input({ player: { paused: false, buffering: false, positionMs: 30_000, rate: 1 } })
    );

    expect(plan).toMatchObject({ hardSeek: true, cooldownUntil: 9_000, driftMs: 15_000 });
  });

  it.each([
    { phase: 'lobby', positionMs: 0, anchorAt: 0 },
    { phase: 'paused', positionMs: 20_000, anchorAt: 1_000 },
  ] as const)(
    'holds the player still at the $phase position',
    ({ phase, positionMs, anchorAt }) => {
      const playback = { ...PLAYING, phase, positionMs, anchorAt };

      const plan = planPartySync(
        input({ playback, player: { paused: false, buffering: false, positionMs: 5_000, rate: 1 } })
      );

      expect(plan.steps).toEqual([{ type: 'pause' }, { type: 'seek', positionMs }]);
    }
  );

  it('holds the player still during a countdown, before the anchor', () => {
    const playback = { ...PLAYING, positionMs: 0, anchorAt: 9_000 };

    const plan = planPartySync(
      input({ playback, player: { paused: true, buffering: false, positionMs: 0, rate: 1 } })
    );

    expect(plan.steps).toEqual([]);
  });
});
