import { act, renderHook } from '@testing-library/react';
import { useVideoCardHover } from '../use-video-card-hover';

describe('@vp/components: useVideoCardHover', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('expands after 500 ms of waiting', () => {
    const { result } = renderHook(() => useVideoCardHover());

    act(() => result.current.wait());
    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(result.current.expanded).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.expanded).toBe(true);
  });

  it.each([
    {
      name: 'cancel',
      end: (result: { current: ReturnType<typeof useVideoCardHover> }) => result.current.cancel(),
    },
    { name: 'a scroll', end: () => window.dispatchEvent(new Event('scroll')) },
  ])('collapses on $name', ({ end }) => {
    const { result } = renderHook(() => useVideoCardHover());
    act(() => result.current.wait());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => end(result));

    expect(result.current.expanded).toBe(false);
  });
});
