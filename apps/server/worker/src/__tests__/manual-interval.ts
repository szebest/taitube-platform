import type { Every } from '../heartbeat';

/** A scheduler the spec advances by hand, so no real interval has to elapse. */
export function manualInterval() {
  const ticks = new Set<() => Promise<void>>();
  const every: Every = (_intervalMs, tick) => {
    ticks.add(tick);
    return { stop: () => ticks.delete(tick) };
  };
  return { every, advance: () => Promise.all([...ticks].map((tick) => tick())), ticks };
}
