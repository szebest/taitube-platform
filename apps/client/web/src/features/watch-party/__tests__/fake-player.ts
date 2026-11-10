import type { PlayerCommands, PlayerState } from '#app/lib/player/player-port';

type FakeState = Pick<
  PlayerState,
  'paused' | 'buffering' | 'ended' | 'currentTime' | 'duration' | 'playbackRate'
>;

const INITIAL: FakeState = {
  paused: true,
  buffering: false,
  ended: false,
  currentTime: 0,
  duration: 600,
  playbackRate: 1,
};

/** What the player under the party hooks reports and was told to do; a spec sets `state` and re-renders. */
export const fakePlayer = {
  state: { ...INITIAL },
  commands: {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setPlaybackRate: vi.fn(),
    selectVideoRendition: vi.fn(),
    requestFullscreen: vi.fn(),
    exitFullscreen: vi.fn(),
    requestControlsLock: vi.fn(() => () => undefined),
    selectCaptionTrack: vi.fn(),
    toggleCaptions: vi.fn(),
    setCaptionStyle: vi.fn(),
  } satisfies PlayerCommands,
};

export function resetFakePlayer() {
  fakePlayer.state = { ...INITIAL };
  for (const command of Object.values(fakePlayer.commands)) {
    command.mockClear();
  }
}

/** The module `usePlayerState` and `usePlayerCommands` come from, answering from `fakePlayer`. */
export function fakeEngine() {
  return {
    usePlayerState: <Selected>(select: (state: PlayerState) => Selected) =>
      select(fakePlayer.state as PlayerState),
    usePlayerCommands: () => fakePlayer.commands,
  };
}
