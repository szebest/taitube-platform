import { useSyncExternalStore } from 'react';

const TICK_MS = 250;

const IDLE = () => () => undefined;

const ticking = (notify: () => void) => {
  const timer = setInterval(notify, TICK_MS);
  return () => clearInterval(timer);
};

const currentTick = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

/** Whole seconds left until `until` (a time in ms), counting down while there is any; 0 for no wait. */
export function useCountdown(until: number | null): number {
  const now = useSyncExternalStore(until === null ? IDLE : ticking, currentTick, () => 0);

  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}
