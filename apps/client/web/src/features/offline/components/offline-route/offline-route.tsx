import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { OfflineState } from '#app/components/states/offline-state';
import { useOfflineCache } from '#app/features/offline/hooks/use-offline-cache';
import { useQueuedChanges } from '#app/features/offline/hooks/use-queued-changes';
import { connectionIsBack } from '#app/features/offline/utils/check-connection';

/**
 * The page the worker serves when a page load fails: what still works, one way back to Home, and a
 * retry that goes there once the connection answers.
 */
export function OfflineRoute() {
  const { tOr } = useT();
  const { feedPages, savedVideos } = useOfflineCache();
  const queued = useQueuedChanges();

  const retry = async () => {
    if (await connectionIsBack()) {
      window.location.assign('/');
    }
  };

  return (
    <OfflineState.Root size="page" onRetry={retry}>
      <OfflineState.Title asChild>
        <h1>{tOr('pwa.offlineTitle', {}, '')}</h1>
      </OfflineState.Title>
      <OfflineState.Description>
        {queued > 0
          ? tOr('pwa.offlineQueuedChanges', { count: queued }, '')
          : tOr('pwa.offlineDescription', {}, '')}
      </OfflineState.Description>
      {(feedPages > 0 || savedVideos.length > 0) && (
        <OfflineState.Available>
          {feedPages > 0 && (
            <OfflineState.Link
              count={tOr('pwa.offlineFeedCount', { count: feedPages }, '')}
              asChild
            >
              <Link to="/">{tOr('pwa.offlineFeed', {}, '')}</Link>
            </OfflineState.Link>
          )}
          {savedVideos.map(({ id, title }) => (
            <OfflineState.Link key={id} asChild>
              <Link to="/watch/$videoId" params={{ videoId: id }}>
                {title || tOr('browse.untitled', {}, '')}
              </Link>
            </OfflineState.Link>
          ))}
        </OfflineState.Available>
      )}
      <OfflineState.Action asChild>
        <Link to="/">{tOr('pwa.offlineHome', {}, '')}</Link>
      </OfflineState.Action>
    </OfflineState.Root>
  );
}
