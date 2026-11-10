import { act, renderHook } from '@testing-library/react';
import { usePartyCountdown } from '../use-party-countdown';

describe('apps/client/web: usePartyCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts the whole seconds down on the room clock and ends at zero', () => {
    let now = 7_000;
    const { result } = renderHook(() => usePartyCountdown(10_000, () => now));
    expect(result.current).toBe(3);

    now = 8_100;
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe(2);

    now = 10_000;
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBeNull();
  });

  it.each([
    { scenario: 'no countdown running', endsAt: null },
    { scenario: 'a countdown that already ended', endsAt: 1_000 },
  ])('is null for $scenario', ({ endsAt }) => {
    const { result } = renderHook(() => usePartyCountdown(endsAt, () => 5_000));

    expect(result.current).toBeNull();
  });
});
