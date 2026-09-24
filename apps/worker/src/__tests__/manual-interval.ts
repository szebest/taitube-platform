import type { Every } from '../heartbeat';

/** A scheduler the spec advances by hand, so no real interval has to elapse. */
export function manualInterval() {
  const ticks: Array<() => Promise<void>> = [];
  const every: Every = (_intervalMs, tick) => {
    ticks.push(tick);
    return { stop: () => ticks.splice(ticks.indexOf(tick), 1) };
  };
  return { every, advance: () => Promise.all(ticks.map((tick) => tick())), ticks };
}
