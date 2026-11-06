import { act, renderHook } from '@testing-library/react';

import { useNow } from '../use-now';

const START = Date.parse('2026-11-05T10:00:00.000Z');

describe('apps/client/studio: useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: START });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the clock at once and again every interval', () => {
    const { result } = renderHook(() => useNow(true, 1000));

    expect(result.current).toBe(START);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(START + 3000);
  });

  it('says nothing while it is not running', () => {
    const { result } = renderHook(() => useNow(false));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBeUndefined();
  });
});
