import { useEffect, useState } from 'react';

/** The clock in epoch milliseconds, ticking while `running`; `undefined` until the first tick, so the server and the browser agree. */
export function useNow(running: boolean, intervalMs = 1000): number | undefined {
  const [now, setNow] = useState<number>();

  useEffect(() => {
    if (!running) {
      return;
    }

    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    const stop = () => clearInterval(timer);

    return stop;
  }, [running, intervalMs]);

  return now;
}
