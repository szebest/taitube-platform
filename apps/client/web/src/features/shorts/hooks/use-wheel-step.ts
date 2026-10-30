import { useRef, type WheelEvent } from 'react';

const WHEEL_THRESHOLD_PX = 24;
const GESTURE_GAP_MS = 150;

/** A wheel handler that steps once per gesture: a trackpad's inertia, a stream of events, is one step. */
export function useWheelStep({
  onPrevious,
  onNext,
}: {
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const lastEvent = useRef(0);
  const stepped = useRef(false);

  return (event: WheelEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.target as Node)) {
      return;
    }

    if (event.timeStamp - lastEvent.current > GESTURE_GAP_MS) {
      stepped.current = false;
    }
    lastEvent.current = event.timeStamp;

    const step = event.deltaY > 0 ? onNext : onPrevious;
    if (stepped.current || Math.abs(event.deltaY) < WHEEL_THRESHOLD_PX || !step) {
      return;
    }

    stepped.current = true;
    step();
  };
}
