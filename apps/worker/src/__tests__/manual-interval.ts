import type { Every } from '../heartbeat';

/** A scheduler the spec advances by hand, so no real interval has to elapse. */
export function manualInterval() {
  const ticks: Array<() => Promise<void>> = [];
  const every: Every = (_intervalMs, tick) => {
    ticks.push(tick);
    const stop = () => {
      const at = ticks.indexOf(tick);
      if (at !== -1) ticks.splice(at, 1);
    };
    return { stop };
  };
  return { every, advance: () => Promise.all(ticks.map((tick) => tick())), ticks };
}
