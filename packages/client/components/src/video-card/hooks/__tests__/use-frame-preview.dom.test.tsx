import { act, renderHook } from '@testing-library/react';
import { useFramePreview } from '../use-frame-preview';

describe('@vp/components: useFramePreview', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays after 500 ms of rest, and not a moment before', () => {
    const { result } = renderHook(() => useFramePreview());

    act(() => result.current.wait());
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.playing).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.playing).toBe(true);
  });

  it.each([
    {
      name: 'cancel',
      end: (result: { current: ReturnType<typeof useFramePreview> }) => result.current.cancel(),
    },
    { name: 'a scroll', end: () => window.dispatchEvent(new Event('scroll')) },
  ])('stops on $name, and a wait that never finished never starts', ({ end }) => {
    const { result } = renderHook(() => useFramePreview());
    act(() => result.current.wait());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => end(result));
    expect(result.current.playing).toBe(false);

    act(() => result.current.wait());
    act(() => end(result));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.playing).toBe(false);
  });

  it('plays one at a time: a second card starting stops the first', () => {
    const first = renderHook(() => useFramePreview());
    const second = renderHook(() => useFramePreview());
    act(() => first.result.current.wait());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(first.result.current.playing).toBe(true);

    act(() => second.result.current.wait());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(second.result.current.playing).toBe(true);
    expect(first.result.current.playing).toBe(false);
  });
});
