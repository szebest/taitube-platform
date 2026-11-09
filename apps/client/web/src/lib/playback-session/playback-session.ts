import type { VideoSummary } from '@vp/api-contracts';

export type QueueRepeat = 'off' | 'all' | 'one';

export interface PlaybackSession {
  videos: readonly VideoSummary[];
  playlistId: string | undefined;
  /** The ids the playlist held when it was loaded, so a later change to it is told from the viewer's own reorder. */
  source: readonly string[];
  shuffle: boolean;
  repeat: QueueRepeat;
  /** The ids played so far, the current one last: what a shuffled queue skips and steps back through. */
  played: readonly string[];
  current: { video: VideoSummary; startTime: number | undefined } | undefined;
  paused: boolean;
}

export const EMPTY_SESSION: PlaybackSession = {
  videos: [],
  playlistId: undefined,
  source: [],
  shuffle: false,
  repeat: 'off',
  played: [],
  current: undefined,
  paused: true,
};

export type PlaybackAction =
  | {
      type: 'open';
      video: VideoSummary;
      list: string | undefined;
      playlist: { id: string; videos: readonly VideoSummary[] } | undefined;
      startTime: number | undefined;
      autoplay: boolean;
    }
  | { type: 'go'; video: VideoSummary; back?: boolean }
  | { type: 'reorder'; id: string; toIndex: number }
  | { type: 'remove'; id: string }
  | { type: 'append'; video: VideoSummary }
  | { type: 'modes'; shuffle: boolean; repeat: QueueRepeat }
  | { type: 'paused'; paused: boolean }
  | { type: 'close' };

function currentIndex({ videos, current }: PlaybackSession): number {
  return videos.findIndex(({ id }) => id === current?.video.id);
}

export function nextVideo(
  session: PlaybackSession,
  random: () => number = Math.random
): VideoSummary | undefined {
  const { videos, shuffle, repeat, played, current } = session;
  const index = currentIndex(session);
  if (index < 0) {
    return undefined;
  }

  if (!shuffle) {
    return videos[index + 1] ?? (repeat === 'all' ? videos[0] : undefined);
  }

  const others = videos.filter(({ id }) => id !== current?.video.id);
  const unplayed = others.filter(({ id }) => !played.includes(id));
  const pool = unplayed.length > 0 || repeat !== 'all' ? unplayed : others;
  return pool[Math.floor(random() * pool.length)];
}

export function previousVideo(session: PlaybackSession): VideoSummary | undefined {
  const { videos, shuffle, repeat, played } = session;
  const index = currentIndex(session);
  if (index < 0) {
    return undefined;
  }

  if (shuffle) {
    const before = played.at(-2);
    return videos.find(({ id }) => id === before);
  }

  return videos[index - 1] ?? (repeat === 'all' ? videos.at(-1) : undefined);
}

const played = (ids: readonly string[], id: string) => (ids.at(-1) === id ? ids : [...ids, id]);

function open(
  state: PlaybackSession,
  { video, list, playlist, startTime, autoplay }: Extract<PlaybackAction, { type: 'open' }>
): PlaybackSession {
  const playlistIds = playlist?.videos.map(({ id }) => id);
  const loadsPlaylist =
    playlist !== undefined &&
    (playlist.id !== state.playlistId || playlistIds?.join() !== state.source.join());
  let queue = {
    videos: state.videos,
    playlistId: state.playlistId,
    source: state.source,
    played: state.played,
  };

  if (loadsPlaylist) {
    queue = {
      videos: playlist.videos,
      playlistId: playlist.id,
      source: playlist.videos.map(({ id }) => id),
      played: [],
    };
  } else if (list === undefined && !state.videos.some(({ id }) => id === video.id)) {
    queue =
      state.playlistId === undefined
        ? { ...queue, videos: [video, ...state.videos] }
        : { videos: [video], playlistId: undefined, source: [], played: [] };
  }

  if (state.current?.video.id === video.id) {
    return {
      ...state,
      ...queue,
      played: played(queue.played, video.id),
      current: { video, startTime: state.current.startTime },
    };
  }

  return {
    ...state,
    ...queue,
    played: played(queue.played, video.id),
    current: { video, startTime },
    paused: !autoplay,
  };
}

export function playbackReducer(state: PlaybackSession, action: PlaybackAction): PlaybackSession {
  switch (action.type) {
    case 'open':
      return open(state, action);
    case 'go':
      return {
        ...state,
        current: { video: action.video, startTime: undefined },
        paused: false,
        played: action.back ? state.played.slice(0, -1) : played(state.played, action.video.id),
      };
    case 'reorder': {
      const picked = state.videos.find(({ id }) => id === action.id);
      if (!picked) {
        return state;
      }

      const rest = state.videos.filter(({ id }) => id !== action.id);
      return {
        ...state,
        videos: [...rest.slice(0, action.toIndex), picked, ...rest.slice(action.toIndex)],
      };
    }
    case 'remove':
      return { ...state, videos: state.videos.filter(({ id }) => id !== action.id) };
    case 'append':
      return state.videos.some(({ id }) => id === action.video.id)
        ? state
        : { ...state, videos: [...state.videos, action.video] };
    case 'modes':
      return { ...state, shuffle: action.shuffle, repeat: action.repeat };
    case 'paused':
      return { ...state, paused: action.paused };
    case 'close':
      return { ...state, current: undefined, paused: true };
  }
}
