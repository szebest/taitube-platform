import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createQueryClient } from '@vp/queries';
import type { PropsWithChildren } from 'react';

import { homeKeys } from '#app/features/home/api/home-queries';
import { usePickWindow } from '../use-pick-window';

const NOW = Date.parse('2026-10-30T10:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function renderWindow(endsAt: string) {
  const queryClient = createQueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, ...renderHook(() => usePickWindow(endsAt), { wrapper }) };
}

describe('apps/client/web: usePickWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { left: 14 * HOUR, minutes: 840 },
    { left: 40 * MINUTE, minutes: 40 },
    { left: 90_000, minutes: 2 },
    { left: 1_000, minutes: 1 },
  ])('reads $minutes minutes with $left ms left', ({ left, minutes }) => {
    const { result } = renderWindow(at(left));

    expect(result.current).toBe(minutes);
  });

  it('counts down on the minute boundaries and drops nothing while the window is open', () => {
    const { result, invalidate } = renderWindow(at(90_000));

    act(() => {
      vi.advanceTimersByTime(30_001);
    });
    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('drops the cached pick once the window ends', () => {
    const { result, invalidate } = renderWindow(at(MINUTE));

    act(() => {
      vi.advanceTimersByTime(MINUTE + 1);
    });

    expect(result.current).toBe(0);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: homeKeys.pick() });
  });

  it('drops a pick that has already ended', () => {
    const { invalidate } = renderWindow(at(-MINUTE));

    expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: homeKeys.pick() });
  });

  it('stops its timer on unmount', () => {
    const { unmount } = renderWindow(at(HOUR));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
