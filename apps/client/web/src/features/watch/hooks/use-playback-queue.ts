import type { VideoSummary } from '@vp/api-contracts';
import { use } from 'react';

import { nextVideo, previousVideo } from '../playback-session';
import { PlaybackSessionContext } from '../playback-session.context';

export function usePlaybackSession() {
  const value = use(PlaybackSessionContext);
  if (value === undefined) {
    throw new Error('usePlaybackSession must be used within PlaybackSessionProvider');
  }

  return value;
}

/** The viewer's queue, which outlives the page that shows it: the order, the modes and where playback is. */
export function usePlaybackQueue() {
  const { session, dispatch } = usePlaybackSession();

  return {
    ...session,
    reorder: (id: string, toIndex: number) => dispatch({ type: 'reorder', id, toIndex }),
    remove: (id: string) => dispatch({ type: 'remove', id }),
    append: (video: VideoSummary) => dispatch({ type: 'append', video }),
    setModes: (modes: { shuffle: boolean; repeat: typeof session.repeat }) =>
      dispatch({ type: 'modes', ...modes }),
    setPaused: (paused: boolean) => dispatch({ type: 'paused', paused }),
    close: () => dispatch({ type: 'close' }),
    go: (video: VideoSummary, back = false) => dispatch({ type: 'go', video, back }),
    next: () => nextVideo(session),
    previous: () => previousVideo(session),
  };
}
