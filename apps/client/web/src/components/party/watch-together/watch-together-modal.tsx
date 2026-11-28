import { ResponsiveModal } from '@kit/ui';
import { useState } from 'react';
import { urlModals } from '#app/lib/url-modal/registry';
import { WatchTogetherContext } from './watch-together.context';
import { LazyWatchTogetherContent } from './watch-together.lazy';

/** `?modal=watch-together&videoId=`: the same dialog for a place that cannot hold its own, such as a card's menu. */
export function WatchTogetherModal() {
  const { params, close } = urlModals.useUrlModal('watch-together');
  const [withStart, setWithStart] = useState(true);

  if (!params) {
    return null;
  }

  return (
    <ResponsiveModal.Root open onOpenChange={(open) => !open && close()}>
      <WatchTogetherContext
        value={{
          source: params.videoId ? { kind: 'video', videoId: params.videoId } : { kind: 'empty' },
          withStart,
          setWithStart,
          container: undefined,
        }}
      >
        <LazyWatchTogetherContent />
      </WatchTogetherContext>
    </ResponsiveModal.Root>
  );
}
