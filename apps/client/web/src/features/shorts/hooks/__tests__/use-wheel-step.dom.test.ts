import { renderHook } from '@testing-library/react';
import type { WheelEvent } from 'react';

import { useWheelStep } from '../use-wheel-step';

const wheel = (deltaY: number, timeStamp: number) =>
  ({ deltaY, timeStamp }) as WheelEvent<HTMLElement>;

function renderStep() {
  const onNext = vi.fn();
  const onPrevious = vi.fn();
  const { result } = renderHook(() => useWheelStep({ onNext, onPrevious }));
  return { step: result.current, onNext, onPrevious };
}

describe('apps/client/web: useWheelStep', () => {
  it.each([
    { scenario: 'down', deltaY: 80, next: 1, previous: 0 },
    { scenario: 'up', deltaY: -80, next: 0, previous: 1 },
    { scenario: 'a nudge too small to mean it', deltaY: 10, next: 0, previous: 0 },
  ])('a wheel $scenario steps $next forward and $previous back', ({ deltaY, next, previous }) => {
    const { step, onNext, onPrevious } = renderStep();

    step(wheel(deltaY, 1_000));

    expect(onNext).toHaveBeenCalledTimes(next);
    expect(onPrevious).toHaveBeenCalledTimes(previous);
  });

  it('steps once for events that follow each other, and again after a pause', () => {
    const { step, onNext } = renderStep();

    step(wheel(100, 1_000));
    step(wheel(100, 1_050));
    step(wheel(100, 1_100));
    step(wheel(100, 1_500));

    expect(onNext).toHaveBeenCalledTimes(2);
  });

  it('does nothing in a direction that leads nowhere', () => {
    const onNext = vi.fn();
    const { result } = renderHook(() => useWheelStep({ onNext }));

    result.current(wheel(-100, 1_000));

    expect(onNext).not.toHaveBeenCalled();
  });
});
