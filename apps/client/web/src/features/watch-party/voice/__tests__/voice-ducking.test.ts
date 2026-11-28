import { DEFAULT_DUCK_LEVEL, createDucker } from '../voice-ducking';

function playerAt(initial: number) {
  const player = {
    level: initial,
    volume: () => player.level,
    setVolume: (next: number) => {
      player.level = next;
    },
  };
  return player;
}

describe('apps/client/web: ducking through the player', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('drops to the level in 150 ms and returns in 600 ms', () => {
    const player = playerAt(0.8);
    const ducker = createDucker(player, () => DEFAULT_DUCK_LEVEL);

    ducker.setAudible(true);
    vi.advanceTimersByTime(60);
    expect(player.level).toBeGreaterThan(0.8 * DEFAULT_DUCK_LEVEL);
    expect(player.level).toBeLessThan(0.8);
    vi.advanceTimersByTime(100);
    expect(player.level).toBeCloseTo(0.8 * DEFAULT_DUCK_LEVEL);

    ducker.setAudible(false);
    vi.advanceTimersByTime(300);
    expect(player.level).toBeLessThan(0.8);
    vi.advanceTimersByTime(330);
    expect(player.level).toBeCloseTo(0.8);
  });

  it('puts the volume back at once when it is disposed mid duck', () => {
    const player = playerAt(1);
    const ducker = createDucker(player, () => 0.2);

    ducker.setAudible(true);
    vi.advanceTimersByTime(200);
    ducker.dispose();

    expect(player.level).toBe(1);
  });
});
