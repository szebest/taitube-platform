import { useEffect, useState } from 'react';

const TICK_MS = 10_000;

/** The time now, refreshed often enough that a mute with an end time lifts about when it ends. */
export function usePartyClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);

    return () => clearInterval(timer);
  }, []);

  return now;
}
