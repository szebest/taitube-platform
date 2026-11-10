import { act, renderHook } from '@testing-library/react';
import type { WatchPartyState } from '@vp/queries';
import { fakePlayer, resetFakePlayer } from '#app/features/watch-party/__tests__/fake-player';
import { partyState } from '#app/features/watch-party/__tests__/party-state';
import { usePartySync } from '../use-party-sync';

vi.mock(import('#app/integrations/video-js/video-js-engine'), async () =>
  (await import('#app/features/watch-party/__tests__/fake-player')).fakeEngine()
);

const PLAYING = {
  itemId: '0190c3a0-5e1d-7000-8000-000000009201',
  phase: 'playing',
  positionMs: 10_000,
  rate: 1,
  anchorAt: 1_000,
} as const;

const SERVER_NOW = 6_000;

function renderSync(state: WatchPartyState) {
  const send = vi.fn(() => true);
  const rendered = renderHook(() => usePartySync({ state, serverNow: () => SERVER_NOW, send }));

  return { ...rendered, send };
}

describe('apps/client/web: usePartySync', () => {
  beforeEach(() => {
    resetFakePlayer();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays when the room plays and the player is paused', () => {
    renderSync(partyState({ playback: PLAYING }));

    expect(fakePlayer.commands.play).toHaveBeenCalled();
  });

  it('puts a paused room position on the player', () => {
    fakePlayer.state.paused = false;
    renderSync(partyState({ playback: { ...PLAYING, phase: 'paused', positionMs: 42_000 } }));

    expect(fakePlayer.commands.pause).toHaveBeenCalled();
    expect(fakePlayer.commands.seek).toHaveBeenCalledWith(42);
  });

  it('does nothing before the player has its duration', () => {
    fakePlayer.state.duration = 0;
    renderSync(partyState({ playback: PLAYING }));

    expect(fakePlayer.commands.play).not.toHaveBeenCalled();
  });

  it('mutes and offers sound when the browser refused to play, then takes it back', () => {
    const { result } = renderSync(partyState({ playback: PLAYING }));

    act(() => vi.advanceTimersByTime(1_000));

    expect(fakePlayer.commands.setMuted).toHaveBeenCalledWith(true);
    expect(result.current.soundBlocked).toBe(true);

    act(() => result.current.enableSound());

    expect(fakePlayer.commands.setMuted).toHaveBeenLastCalledWith(false);
    expect(result.current.soundBlocked).toBe(false);
  });

  it('is catching up while it seeks toward the room position', () => {
    fakePlayer.state.paused = false;
    fakePlayer.state.currentTime = 0;

    const { result } = renderSync(partyState({ playback: PLAYING }));

    expect(fakePlayer.commands.seek).toHaveBeenCalledWith(15);
    expect(result.current.catchingUp).toBe(true);
  });

  it('tells the room when the player buffers, and once when it stops', () => {
    const { send, rerender } = renderSync(partyState({ playback: PLAYING }));

    fakePlayer.state.buffering = true;
    rerender();
    rerender();
    fakePlayer.state.buffering = false;
    rerender();

    expect(send.mock.calls).toEqual([
      [{ type: 'buffering', buffering: true }],
      [{ type: 'buffering', buffering: false }],
    ]);
  });

  it('tells the room when the item ended, with the versions it saw', () => {
    const { send, rerender } = renderSync(
      partyState({ playback: PLAYING, version: 7, rolesVersion: 3 })
    );

    fakePlayer.state.ended = true;
    rerender();

    expect(send).toHaveBeenCalledWith({
      type: 'ended',
      itemId: PLAYING.itemId,
      version: 7,
      rolesVersion: 3,
    });
  });

  it('reports its drift to the room every thirty seconds', () => {
    fakePlayer.state.paused = false;
    fakePlayer.state.currentTime = 0;
    const { send } = renderSync(partyState({ playback: PLAYING }));

    act(() => vi.advanceTimersByTime(30_000));

    expect(send).toHaveBeenCalledWith({
      type: 'stats',
      driftMs: 15_000,
      hardSeeks: expect.any(Number),
    });
  });
});
