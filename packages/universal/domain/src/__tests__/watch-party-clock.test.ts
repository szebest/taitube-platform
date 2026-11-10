import {
  type ClockSample,
  type PlaybackCommand,
  type WatchPartyPlayback,
  advancePlayback,
  applyPlaybackCommand,
  clockOffsetMs,
  expectedPositionMs,
  isNearEnd,
  lobbyPlayback,
} from '../watch-party-clock';

const NOW = 1_000_000;

function playbackOf(overrides: Partial<WatchPartyPlayback> = {}): WatchPartyPlayback {
  return {
    itemId: 'item-1',
    phase: 'playing',
    positionMs: 10_000,
    rate: 1,
    anchorAt: NOW,
    ...overrides,
  };
}

describe('@vp/domain: the room clock', () => {
  it.each([
    { scenario: 'playing 5 s after the anchor', playback: {}, at: NOW + 5000, expected: 15_000 },
    { scenario: 'playing at 2x', playback: { rate: 2 as const }, at: NOW + 5000, expected: 20_000 },
    {
      scenario: 'playing at 0.5x',
      playback: { rate: 0.5 as const },
      at: NOW + 5000,
      expected: 12_500,
    },
    {
      scenario: 'paused',
      playback: { phase: 'paused' as const },
      at: NOW + 5000,
      expected: 10_000,
    },
    {
      scenario: 'in the lobby',
      playback: { phase: 'lobby' as const },
      at: NOW + 5000,
      expected: 10_000,
    },
    { scenario: 'counting down to the anchor', playback: {}, at: NOW - 2000, expected: 10_000 },
  ])('expects the position $scenario', ({ playback, at, expected }) => {
    expect(expectedPositionMs(playbackOf(playback), at)).toBe(expected);
  });

  it.each<{
    command: PlaybackCommand;
    from: Partial<WatchPartyPlayback>;
    expected: Partial<WatchPartyPlayback>;
  }>([
    {
      command: { type: 'play' },
      from: { phase: 'paused', anchorAt: 0 },
      expected: { phase: 'playing', positionMs: 10_000, anchorAt: NOW },
    },
    {
      command: { type: 'pause', positionMs: 12_345 },
      from: {},
      expected: { phase: 'paused', positionMs: 12_345, anchorAt: NOW },
    },
    {
      command: { type: 'seek', positionMs: 60_000 },
      from: { anchorAt: NOW - 4000 },
      expected: { phase: 'playing', positionMs: 60_000, anchorAt: NOW },
    },
    {
      command: { type: 'rate', rate: 2 },
      from: { anchorAt: NOW - 4000 },
      expected: { positionMs: 14_000, rate: 2, anchorAt: NOW },
    },
    {
      command: { type: 'start' },
      from: { phase: 'lobby', positionMs: 0, anchorAt: 0 },
      expected: { phase: 'playing', positionMs: 0, anchorAt: NOW + 3000 },
    },
  ])('applies $command.type', ({ command, from, expected }) => {
    expect(applyPlaybackCommand(playbackOf(from), command, NOW)).toMatchObject(expected);
  });

  it.each([
    {
      scenario: 'the next item from its start',
      next: { itemId: 'item-2', startMs: 5000 },
      expected: { itemId: 'item-2', phase: 'playing', positionMs: 5000, anchorAt: NOW },
    },
    { scenario: 'finished when the queue ran out', next: null, expected: { phase: 'finished' } },
  ])('advances to $scenario', ({ next, expected }) => {
    expect(advancePlayback(playbackOf(), next, NOW)).toMatchObject(expected);
  });

  it('opens a room in the lobby on its first item', () => {
    expect(lobbyPlayback('item-1', 4000)).toEqual({
      itemId: 'item-1',
      phase: 'lobby',
      positionMs: 4000,
      rate: 1,
      anchorAt: 0,
    });
  });

  it.each([
    { scenario: 'within 2 s of the end', at: NOW + 48_500, near: true },
    { scenario: '10 s early', at: NOW + 40_000, near: false },
  ])('takes an ended report $scenario: $near', ({ at, near }) => {
    expect(isNearEnd(playbackOf(), 60_000, at)).toBe(near);
  });
});

describe('@vp/domain: clockOffsetMs', () => {
  const sample = (t0: number, rtt: number, offset: number): ClockSample => ({
    t0,
    t1: t0 + rtt,
    serverNow: t0 + rtt / 2 + offset,
  });

  it('has no offset before the first sample', () => {
    expect(clockOffsetMs([])).toBeNull();
  });

  it('keeps the offset of the lowest round trip among the last 8 samples', () => {
    const samples = [
      sample(0, 10, -999),
      ...[80, 60, 40, 20, 90, 70, 50].map((rtt, index) => sample(1000 * (index + 1), rtt, rtt)),
      sample(9000, 30, 500),
    ];

    expect(clockOffsetMs(samples)).toBe(20);
  });
});
