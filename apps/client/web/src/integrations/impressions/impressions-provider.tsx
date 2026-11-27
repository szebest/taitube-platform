import { sendJsonBeacon } from '@kit/web-telemetry';
import { useRouterState } from '@tanstack/react-router';
import { recordImpressions } from '@vp/api-contracts';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '#app/lib/config';
import { createImpressionQueue, type Impression } from '#app/lib/impressions/impression-queue';

const RecordImpressionContext = createContext<((impression: Impression) => void) | undefined>(
  undefined
);

/**
 * Collects the test variants the cards showed and beacons them to the API, the way the playback
 * beacon goes: a page view lasts until the path changes, and what is queued leaves when the page
 * is hidden or closed.
 */
export function ImpressionsProvider({ children }: PropsWithChildren) {
  const [queue] = useState(() =>
    createImpressionQueue((batch) =>
      sendJsonBeacon(`${API_BASE_URL}${recordImpressions.path}`, batch)
    )
  );
  const pathname = useRouterState({ select: ({ location }) => location.pathname });

  useEffect(() => {
    queue.view(pathname);
  }, [queue, pathname]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') queue.flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', queue.flush);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', queue.flush);
      queue.flush();
    };
  }, [queue]);

  return <RecordImpressionContext value={queue.record}>{children}</RecordImpressionContext>;
}

/** Counts an impression, or nothing outside `ImpressionsProvider`. */
export function useRecordImpression(): ((impression: Impression) => void) | undefined {
  return useContext(RecordImpressionContext);
}
