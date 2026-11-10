import { act, renderHook } from '@testing-library/react';
import { usePartyClock } from '../use-party-clock';

describe('apps/client/web: usePartyClock', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-05T20:00:00.000Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the time now and moves with the clock every ten seconds', () => {
    const { result } = renderHook(() => usePartyClock());
    expect(result.current.toISOString()).toBe('2026-11-05T20:00:00.000Z');

    act(() => vi.advanceTimersByTime(10_000));

    expect(result.current.toISOString()).toBe('2026-11-05T20:00:10.000Z');
  });
});
