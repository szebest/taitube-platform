import { useEffect, useState } from 'react';

import { playChime } from '../overlay-chime';

/** @internal */
export const SUBSCRIBER_ALERT_MS = 6000;

/** The subscriber count to announce while an alert shows, or `null`. The first count seen never alerts, nor does a fall. */
export function useSubscriberAlert(count: number): number | null {
  const [seen, setSeen] = useState(count);
  const [announced, setAnnounced] = useState<number | null>(null);

  if (count !== seen) {
    setSeen(count);
    if (count > seen) {
      setAnnounced(count);
    }
  }

  useEffect(() => {
    if (announced === null) {
      return;
    }

    void playChime();
    const timer = setTimeout(() => setAnnounced(null), SUBSCRIBER_ALERT_MS);
    const cancel = () => clearTimeout(timer);

    return cancel;
  }, [announced]);

  return announced;
}
