import type { RefreshSession } from './session-config';

/**
 * One refresh per refused token at a time, however many calls failed with it: with a rotating
 * refresh token a second refresh would fail and clear the session under the first. This app
 * server's alone; two replicas can still race (SDD §11).
 */
export function singleFlightRefresh(refresh: RefreshSession): RefreshSession {
  const running = new Map<string, Promise<string | undefined>>();
  return (refused) => {
    const pending = running.get(refused) ?? refresh(refused).finally(() => running.delete(refused));
    running.set(refused, pending);
    return pending;
  };
}
