/** Exchanges the token the server refused for a fresh one, or says there is none to be had. */
export type RefreshSession = (refused: string) => Promise<string | undefined>;

/**
 * One refresh per refused token at a time, however many calls failed with it: with a rotating
 * refresh token a second refresh would fail and clear the session under the first. This process's
 * alone; two replicas can still race.
 */
export function singleFlightRefresh(refresh: RefreshSession): RefreshSession {
  const running = new Map<string, Promise<string | undefined>>();
  return (refused) => {
    const pending = running.get(refused) ?? refresh(refused).finally(() => running.delete(refused));
    running.set(refused, pending);
    return pending;
  };
}
