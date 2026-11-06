import { act, renderHook } from '@testing-library/react';
import { playChime } from '#app/features/live/utils/overlay-chime';
import { SUBSCRIBER_ALERT_MS, useSubscriberAlert } from '../use-subscriber-alert';

vi.mock(import('#app/features/live/utils/overlay-chime'), () => ({ playChime: vi.fn() }));

function renderAlert(first: number) {
  return renderHook(({ count }) => useSubscriberAlert(count), { initialProps: { count: first } });
}

describe('apps/client/studio: useSubscriberAlert', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('never alerts on the first count it sees', () => {
    const { result } = renderAlert(12);

    expect(result.current).toBeNull();
    expect(playChime).not.toHaveBeenCalled();
  });

  it.each([
    { scenario: 'a rise', from: 12, to: 13, announced: 13, chimes: 1 },
    { scenario: 'a fall', from: 12, to: 11, announced: null, chimes: 0 },
  ])('answers $scenario', ({ from, to, announced, chimes }) => {
    const { result, rerender } = renderAlert(from);

    rerender({ count: to });

    expect(result.current).toBe(announced);
    expect(playChime).toHaveBeenCalledTimes(chimes);
  });

  it('lets the alert go after its time', () => {
    const { result, rerender } = renderAlert(12);
    rerender({ count: 13 });

    act(() => {
      vi.advanceTimersByTime(SUBSCRIBER_ALERT_MS);
    });

    expect(result.current).toBeNull();
  });
});
