import { act, renderHook } from '@testing-library/react';

import { useDebouncedValue } from '../use-debounced-value';

const DELAY_MS = 200;

describe('apps/client/web: useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers the first value at once', () => {
    const { result } = renderHook(() => useDebouncedValue('a', DELAY_MS));

    expect(result.current).toBe('a');
  });

  it('holds the old value until the new one has held still for the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, DELAY_MS), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(DELAY_MS - 1));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('b');
  });

  it('starts the wait over each time the value changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, DELAY_MS), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(DELAY_MS - 1));
    rerender({ value: 'c' });
    act(() => vi.advanceTimersByTime(DELAY_MS - 1));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('c');
  });
});
