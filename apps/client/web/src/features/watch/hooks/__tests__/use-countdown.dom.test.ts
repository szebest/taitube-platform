import { act, renderHook } from '@testing-library/react';
import { useCountdown } from '../use-countdown';

describe('apps/client/web: useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts whole seconds down to zero and stops', () => {
    const { result } = renderHook(() => useCountdown(1_000_000 + 2500));

    expect(result.current).toBe(3);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(2);

    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toBe(0);

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(0);
  });

  it.each([{ until: null }, { until: 999_000 }])('reads $until as no wait', ({ until }) => {
    expect(renderHook(() => useCountdown(until)).result.current).toBe(0);
  });

  it('starts over when the wait is set again', () => {
    const { result, rerender } = renderHook(({ until }) => useCountdown(until), {
      initialProps: { until: null as number | null },
    });

    rerender({ until: 1_000_000 + 4000 });

    expect(result.current).toBe(4);
  });
});
