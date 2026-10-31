import { useT } from '@vp/intl-react';
import { useToast } from '@vp/ui';
import { useEffect, useEffectEvent, useState } from 'react';
import { OfflineState } from '#app/components/states/offline-state';
import { connectionIsBack } from '../check-connection';
import { useQueuedChanges } from '../hooks/use-queued-changes';
import { useOnlineStatus } from '../use-online-status';

async function checkConnection() {
  await connectionIsBack();
}

type Phase = 'online' | 'offline' | 'reconnected';

/**
 * A slim status bar under the header while the connection is gone, a "Back online" line when it
 * returns, and a toast saying what still works at the moment it drops.
 */
export function OfflineBanner() {
  const { tOr } = useT();
  const online = useOnlineStatus();
  const queued = useQueuedChanges();
  const showToast = useToast();
  const [phase, setPhase] = useState<Phase>('online');

  const announceDrop = useEffectEvent(() =>
    showToast({
      title: tOr('pwa.offlineToastTitle', {}, ''),
      description: tOr('pwa.offlineToastDescription', {}, ''),
    })
  );

  useEffect(() => {
    if (online) {
      setPhase((current) => (current === 'offline' ? 'reconnected' : current));
      return;
    }
    setPhase('offline');
    announceDrop();
  }, [online]);

  if (phase === 'online') {
    return null;
  }

  return (
    <OfflineState.Root
      size="banner"
      tone={phase === 'reconnected' ? 'success' : 'neutral'}
      onRetry={checkConnection}
    >
      {phase === 'reconnected' ? (
        <OfflineState.Reconnected onDismiss={() => setPhase('online')} />
      ) : (
        <>
          <OfflineState.Title>{tOr('pwa.offlineTitle', {}, '')}</OfflineState.Title>
          <OfflineState.Description>
            {queued > 0
              ? tOr('pwa.offlineQueuedChanges', { count: queued }, '')
              : tOr('pwa.offlineBannerDescription', {}, '')}
          </OfflineState.Description>
        </>
      )}
    </OfflineState.Root>
  );
}
