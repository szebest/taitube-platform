import { assertNever } from '@kit/result';
import { useToast } from '@kit/ui';
import type { Video } from '@vp/api-contracts';
import { EngagementBar } from '#app/components/watch/engagement-bar';
import { useCanSaveOffline } from '#app/features/offline/hooks/use-can-save-offline';
import { type SaveToggled, useSaveOffline } from '#app/features/offline/hooks/use-save-offline';
import { useT } from '#app/lib/messages';

/** The Save for offline action under a watch page's title; a disabled placeholder until the browser is known to keep videos offline, absent where it cannot. */
export function SaveOfflineToggle({ video }: { video: Video }) {
  const { tOr } = useT();
  const showToast = useToast();
  const available = useCanSaveOffline();
  const { saved, pending, toggle } = useSaveOffline(video);

  if (available === false) {
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
      disabled={pending || available === undefined}
      onClick={async () => announce(await toggle())}
    >
      {saved ? tOr('pwa.savedOffline', {}, '') : tOr('pwa.saveOffline', {}, '')}
    </EngagementBar.Action>
  );
}
