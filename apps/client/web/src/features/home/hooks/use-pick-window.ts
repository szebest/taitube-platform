import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { homeKeys } from '../api/home-queries';

const MINUTE_MS = 60_000;

const minutesLeftAt = (endMs: number) =>
  Math.max(0, Math.ceil((endMs - Date.now()) / MINUTE_MS));
const unknownOnServer = () => undefined;

/**
 * Whole minutes until `endsAt`, counted down on the minute boundaries and `undefined` until the page is
 * live, so the server and the hydration agree. When the window ends it drops the cached pick, and the
 * spotlight gives way to the next one or the fallback.
 */
export function usePickWindow(endsAt: string): number | undefined {
  const queryClient = useQueryClient();
  const endMs = Date.parse(endsAt);

  const subscribe = useCallback(
    (notify: () => void) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const arm = () => {
        const left = endMs - Date.now();
        if (left <= 0) return;
        timer = setTimeout(
          () => {
            notify();
            arm();
          },
          (left % MINUTE_MS || MINUTE_MS) + 1
        );
      };
      arm();
      return () => clearTimeout(timer);
    },
    [endMs]
  );

  const minutes = useSyncExternalStore(subscribe, () => minutesLeftAt(endMs), unknownOnServer);
  const ended = minutes !== undefined && minutes <= 0;

  useEffect(() => {
    if (ended) void queryClient.invalidateQueries({ queryKey: homeKeys.pick() });
  }, [ended, queryClient]);

  return minutes;
}
