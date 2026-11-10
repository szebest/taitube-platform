import { tv } from '@vp/ui';
import { Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { useIsWatching, useOwnsPlayer } from '#app/features/watch/hooks/use-is-watching';
import { useMediaSession } from '#app/features/watch/hooks/use-media-session';
import { useQueueNavigation } from '#app/features/watch/hooks/use-queue-navigation';
import { usePlaybackSession } from '#app/hooks/use-playback-queue';
import { SlotRectStore } from '#app/lib/slot-rect-store';
import { WatchPlayer } from '../watch-player/watch-player';

const hostStyles = tv({
  base: 'fixed inset-bs-0 inset-s-0 overflow-hidden bg-media',
  variants: {
    state: {
      docked: 'z-sticky rounded-thumb',
      mini: 'z-pip rounded-sm',
      hidden: 'pointer-events-none invisible',
    },
  },
});

/**
 * The one player of the session, mounted once above the routes and never reparented: a stage or the mini
 * player offers a slot, and the host sits over it, `position: fixed` and moved with a `translate`, so the
 * `<video>` neither detaches nor pauses when the viewer moves between pages. Nothing plays, nothing mounts.
 */
export function PlaybackHost() {
  const { session, dispatch, slots } = usePlaybackSession();
  const slot = slots.at(-1);
  const [store] = useState(() => new SlotRectStore());
  const rect = useSyncExternalStore(store.subscribe, store.snapshot, () => undefined);
  const watching = useIsWatching();
  const ownsPlayer = useOwnsPlayer();
  const { next, previous, hasNext, hasPrevious } = useQueueNavigation();
  const { current, paused, repeat } = session;

  useEffect(() => store.track(slot), [store, slot]);

  useEffect(() => {
    if (ownsPlayer) {
      dispatch({ type: 'paused', paused: true });
    }
  }, [ownsPlayer, dispatch]);

  useMediaSession({
    video: ownsPlayer ? undefined : current?.video,
    onPlay: () => dispatch({ type: 'paused', paused: false }),
    onPause: () => dispatch({ type: 'paused', paused: true }),
    onPrevious: hasPrevious ? previous : undefined,
    onNext: hasNext ? next : undefined,
  });

  const playbackUrl = current?.video.playbackUrl;
  if (!current || playbackUrl === undefined) {
    return null;
  }

  const { video, startTime } = current;
  const state = rect === undefined ? 'hidden' : watching ? 'docked' : 'mini';

  return (
    <div
      data-slot="playback-host"
      data-state={state}
      className={hostStyles({ state })}
      style={
        rect && {
          width: rect.width,
          height: rect.height,
          transform: `translate(${rect.x}px, ${rect.y}px)`,
        }
      }
    >
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
      </Suspense>
    </div>
  );
}
