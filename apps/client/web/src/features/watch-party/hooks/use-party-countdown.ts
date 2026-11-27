import { useEffect, useEffectEvent, useState } from 'react';

const TICK_MS = 250;
const MS_PER_SECOND = 1000;

/** The whole seconds left until `endsAt` on the room's clock, or `null` with no countdown running. */
export function usePartyCountdown(endsAt: number | null, serverNow: () => number): number | null {
  const [now, setNow] = useState(() => serverNow());

  const readClock = useEffectEvent(() => setNow(serverNow()));

  useEffect(() => {
    if (endsAt === null) {
      return;
    }
    const timer = setInterval(readClock, TICK_MS);

    return () => clearInterval(timer);
  }, [endsAt]);

  if (endsAt === null) {
    return null;
  }
  const left = Math.ceil((endsAt - now) / MS_PER_SECOND);

  return left > 0 ? left : null;
}
