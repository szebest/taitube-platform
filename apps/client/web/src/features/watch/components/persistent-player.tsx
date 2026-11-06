import { Suspense, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { useIsWatching, useOwnsPlayer } from '../hooks/use-is-watching';
import { usePlaybackSession } from '../hooks/use-playback-queue';
import { useQueueNavigation } from '../hooks/use-queue-navigation';
import { WatchPlayer } from './watch-player';

const subscribeNever = () => () => undefined;

/** The one player, rendered into the element the stage or the now playing bar holds, whichever the viewer is on. */
export function PersistentPlayer() {
  const { session, dispatch, host } = usePlaybackSession();
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const watching = useIsWatching();
  const ownsPlayer = useOwnsPlayer();
  const { next, previous, hasNext, hasPrevious } = useQueueNavigation();

  useEffect(() => {
    if (ownsPlayer) {
      dispatch({ type: 'paused', paused: true });
    }
  }, [ownsPlayer, dispatch]);

  const { current, paused, repeat } = session;
  const playbackUrl = current?.video.playbackUrl;
  if (!(hydrated && host && current) || playbackUrl === undefined) {
    return null;
  }

  const { video, startTime } = current;

  return createPortal(
    <Suspense>
      <WatchPlayer
        videoId={video.id}
        playbackUrl={playbackUrl}
        posterUrl={video.posterUrl}
        title={video.title}
        startTime={startTime}
        control={{ paused, muted: false }}
        loop={repeat === 'one'}
        layout={watching ? 'landscape' : 'fill'}
        controls={watching}
        onPlay={() => dispatch({ type: 'paused', paused: false })}
        onPause={() => dispatch({ type: 'paused', paused: true })}
        onPrevious={hasPrevious ? previous : undefined}
        onNext={hasNext ? next : undefined}
      />
    </Suspense>,
    host
  );
}
