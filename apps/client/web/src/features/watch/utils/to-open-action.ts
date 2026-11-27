import type { PlaylistView, Video } from '@vp/api-contracts';
import {
  EMPTY_SESSION,
  type PlaybackAction,
  type PlaybackSession,
  playbackReducer,
} from '#app/lib/playback-session/playback-session';
import { toSegments } from './to-segments';
import { toSummary } from './to-summary';

export interface OpenInPlaybackSession {
  video: Video;
  list: string | undefined;
  startTime: number | undefined;
  autoplay: boolean;
  shareToken: string | undefined;
}

/** The action that hands the watch page's video, and the playlist it was opened from, to the session. */
export function toOpenAction(
  { video, list, startTime, autoplay, shareToken }: OpenInPlaybackSession,
  playlist: PlaylistView | undefined
): Extract<PlaybackAction, { type: 'open' }> {
  return {
    type: 'open',
    video: toSummary(video),
    list,
    playlist: playlist && {
      id: playlist.id,
      videos: playlist.items.map((item) => item.video),
      segments: toSegments(playlist.items),
    },
    startTime,
    autoplay,
    shareToken,
  };
}

/** The session the page's first `open` produces from an empty one, which the server render shows before the effect runs. */
export function getOpenedSession(
  open: OpenInPlaybackSession,
  playlist: PlaylistView | undefined
): PlaybackSession {
  return playbackReducer(EMPTY_SESSION, toOpenAction(open, playlist));
}
