import type { Video } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { assertNever } from '@vp/result';
import { useToast } from '@vp/ui';
import { EngagementBar } from '#app/components/watch/engagement-bar';
import { useCanSaveOffline } from '../hooks/use-can-save-offline';
import { type SaveToggled, useSaveOffline } from '../hooks/use-save-offline';

/** The Save for offline action under a watch page's title; absent where the browser cannot keep videos offline. */
export function SaveOfflineToggle({ video }: { video: Video }) {
  const { tOr } = useT();
  const showToast = useToast();
  const available = useCanSaveOffline();
  const { saved, pending, toggle } = useSaveOffline(video);

  if (!available) {
    return null;
  }

  const announce = (outcome: SaveToggled) => {
    if (outcome.ok) {
      showToast({
        tone: 'success',
        title:
          outcome.value === 'saved'
            ? tOr('pwa.saveOfflineDone', {}, '')
            : tOr('pwa.saveOfflineRemoved', {}, ''),
      });
      return;
    }

    const { error } = outcome;
    switch (error.reason) {
      case 'limit':
        showToast({
          tone: 'danger',
          title: tOr('pwa.saveOfflineLimit', { count: error.limit }, ''),
        });
        return;
      case 'quota':
        showToast({ tone: 'danger', title: tOr('pwa.saveOfflineQuota', {}, '') });
        return;
      case 'unavailable':
        showToast({ tone: 'danger', title: tOr('pwa.saveOfflineUnavailable', {}, '') });
        return;
      case 'failed':
        showToast({ tone: 'danger', title: tOr('pwa.saveOfflineFailed', {}, '') });
        return;
      default:
        assertNever(error, 'SaveOfflineToggle');
    }
  };

  return (
    <EngagementBar.Action
      icon="save"
      pressed={saved}
      disabled={pending}
      onClick={async () => announce(await toggle())}
    >
      {saved ? tOr('pwa.savedOffline', {}, '') : tOr('pwa.saveOffline', {}, '')}
    </EngagementBar.Action>
  );
}
