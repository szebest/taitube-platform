import { useT } from '@vp/intl-react';
import { useToast } from '@vp/ui';
import { useEffect, useEffectEvent, useState } from 'react';
import { OfflineState } from '#app/components/states/offline-state';
import { useOnlineStatus } from '#app/features/offline/hooks/use-online-status';
import { useQueuedChanges } from '#app/features/offline/hooks/use-queued-changes';
import { connectionIsBack } from '#app/features/offline/utils/check-connection';

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
  const [phase, setPhase] = useState<Phase>(online ? 'online' : 'offline');
  const [seenOnline, setSeenOnline] = useState(online);
  if (online !== seenOnline) {
    setSeenOnline(online);
    setPhase(online ? 'reconnected' : 'offline');
  }

  const announceDrop = useEffectEvent(() =>
    showToast({
      title: tOr('pwa.offlineToastTitle', {}, ''),
      description: tOr('pwa.offlineToastDescription', {}, ''),
    })
  );

  useEffect(() => {
    if (online) {
      return;
    }
    const dismissToast = announceDrop();
    return () => dismissToast();
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
