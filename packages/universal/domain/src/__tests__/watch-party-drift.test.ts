import { type DriftInput, correctDrift } from '../watch-party-drift';

const NOW = 50_000;

function driftOf(overrides: Partial<DriftInput> = {}): DriftInput {
  return {
    driftMs: 0,
    expectedMs: 30_000,
    roomRate: 1,
    playerRate: 1,
    seekLatencyMs: 120,
    now: NOW,
    cooldownUntil: 0,
    ...overrides,
  };
}

describe('@vp/domain: correctDrift', () => {
  it.each([
    { scenario: 'under 250 ms', input: { driftMs: 240 }, action: { type: 'hold' } },
    { scenario: '400 ms ahead', input: { driftMs: 400 }, action: { type: 'rate', rate: 0.95 } },
    { scenario: '400 ms behind', input: { driftMs: -400 }, action: { type: 'rate', rate: 1.05 } },
    {
      scenario: '400 ms behind at 2x',
      input: { driftMs: -400, roomRate: 2, playerRate: 2 },
      action: { type: 'rate', rate: 2.1 },
    },
    {
      scenario: 'still 180 ms ahead while nudging',
      input: { driftMs: 180, playerRate: 0.95 },
      action: { type: 'hold' },
    },
    {
      scenario: 'within 100 ms while nudging',
      input: { driftMs: 80, playerRate: 0.95 },
      action: { type: 'rate', rate: 1 },
    },
    {
      scenario: 'over 2 s behind',
      input: { driftMs: -2500 },
      action: { type: 'seek', positionMs: 30_120, cooldownUntil: NOW + 3000 },
    },
    {
      scenario: 'over 2 s ahead inside the seek cooldown',
      input: { driftMs: 2500, cooldownUntil: NOW + 1 },
      action: { type: 'hold' },
    },
  ])('$scenario: $action.type', ({ input, action }) => {
    expect(correctDrift(driftOf(input))).toEqual(action);
  });
});
