import { useSyncExternalStore } from 'react';

const TICK_MS = 1000;

const IDLE = () => () => undefined;

const ticking = (notify: () => void) => {
  const timer = setInterval(notify, TICK_MS);
  return () => clearInterval(timer);
};

const currentTick = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;

const noTick = () => undefined;

/** The clock in epoch milliseconds, ticking every second while `running`; `undefined` until the client reads it, so the server and the browser agree. */
export function useNow(running: boolean): number | undefined {
  return useSyncExternalStore(running ? ticking : IDLE, running ? currentTick : noTick, noTick);
}
