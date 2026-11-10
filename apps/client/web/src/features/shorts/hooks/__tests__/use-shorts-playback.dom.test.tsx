import { act, renderHook } from '@testing-library/react';
import { useShortsPlayback } from '../use-shorts-playback';

describe('apps/client/web: useShortsPlayback', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-motion');
  });

  it('starts playing, muted, at normal speed and without captions', () => {
    const { result } = renderHook(() => useShortsPlayback());

    expect(result.current).toMatchObject({ paused: false, muted: true, speed: 1, captions: false });
  });

  it('starts paused under the reduced motion set', () => {
    document.documentElement.setAttribute('data-motion', 'reduced');

    const { result } = renderHook(() => useShortsPlayback());

    expect(result.current.paused).toBe(true);
  });

  it.each([
    { action: 'togglePlay', field: 'paused', after: true },
    { action: 'toggleMute', field: 'muted', after: false },
    { action: 'toggleCaptions', field: 'captions', after: true },
  ] as const)('flips $field with $action, and back', ({ action, field, after }) => {
    const { result } = renderHook(() => useShortsPlayback());

    act(() => result.current[action]());
    expect(result.current[field]).toBe(after);

    act(() => result.current[action]());
    expect(result.current[field]).toBe(!after);
  });

  it('keeps the speed and the mute chosen when the next Short starts over, and plays it', () => {
    const { result } = renderHook(() => useShortsPlayback());
    act(() => {
      result.current.setSpeed(1.5);
      result.current.toggleMute();
      result.current.togglePlay();
    });

    act(() => result.current.startOver());

    expect(result.current).toMatchObject({ paused: false, muted: false, speed: 1.5 });
  });
});
