import { act, renderHook } from '@testing-library/react';

import { useClamped } from '../use-clamped';

class FakeResizeObserver {
  static instance: FakeResizeObserver | undefined;
  disconnect = vi.fn();
  observe = vi.fn();
  constructor(readonly callback: () => void) {
    FakeResizeObserver.instance = this;
  }
}

const measured = (scrollHeight: number, clientHeight: number) =>
  ({ scrollHeight, clientHeight }) as HTMLParagraphElement;

describe('apps/client/web: useClamped', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeResizeObserver.instance = undefined;
  });

  it.each([
    { scrollHeight: 120, clientHeight: 100, clamped: true },
    { scrollHeight: 100, clientHeight: 100, clamped: false },
  ])(
    'reports $clamped for $scrollHeight over $clientHeight',
    ({ scrollHeight, clientHeight, clamped }) => {
      const { result } = renderHook(useClamped);

      act(() => {
        result.current.measure(measured(scrollHeight, clientHeight));
        FakeResizeObserver.instance?.callback();
      });

      expect(result.current.clamped).toBe(clamped);
    }
  );

  it('disconnects the observer on cleanup and ignores a missing node', () => {
    const { result } = renderHook(useClamped);

    const cleanup = result.current.measure(measured(1, 1));
    expect(result.current.measure(null)).toBeUndefined();
    cleanup?.();

    expect(FakeResizeObserver.instance?.disconnect).toHaveBeenCalledOnce();
  });
});
