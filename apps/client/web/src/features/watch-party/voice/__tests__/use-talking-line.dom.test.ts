import { act, renderHook } from '@testing-library/react';
import { useTalkingLine } from '../use-talking-line';

describe('apps/client/web: the talking line', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('changes at most once a second however fast the speakers change', () => {
    const { result, rerender } = renderHook(({ names }) => useTalkingLine(names), {
      initialProps: { names: ['Ana'] },
    });
    act(() => vi.advanceTimersByTime(0));

    rerender({ names: ['Ana', 'Tom'] });
    act(() => vi.advanceTimersByTime(900));
    expect(result.current).toEqual(['Ana']);

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toEqual(['Ana', 'Tom']);
  });
});
