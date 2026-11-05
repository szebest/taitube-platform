import type { VideoVisibility } from './status-vocabulary';

export const LIVE_STREAM_STATUSES = ['IDLE', 'LIVE', 'ENDED'] as const;
type LiveStreamStatus = (typeof LIVE_STREAM_STATUSES)[number];

export const LIVE_CHAT_MESSAGE_MAX = 200;
export const LIVE_CHAT_SLOW_MODE_MAX_SECONDS = 300;

export interface LiveMarker {
  offsetMs: number;
  label: string;
}

/**
 * One broadcast. A channel holds at most one `IDLE` or `LIVE` row; the stream key and the two
 * tokens move to the next `IDLE` row when a broadcast ends, so OBS keeps one key per channel.
 */
export interface LiveStream {
  id: string;
  channelId: string;
  title: string;
  description: string;
  streamKey: string | null;
  status: LiveStreamStatus;
  visibility: VideoVisibility;
  archiveVisibility: VideoVisibility;
  overlayToken: string | null;
  controlToken: string | null;
  currentViewers: number;
  chatSlowModeSeconds: number;
  chatSubscribersOnly: boolean;
  markers: LiveMarker[];
  startedAt: Date | null;
  endedAt: Date | null;
  /** Set by the creator's stop while still `LIVE`: the ingest refuses a reconnect until the stream ends. */
  stopRequestedAt: Date | null;
  videoId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The ingest path MediaMTX publishes a key on, `live/{streamKey}`. */
const LIVE_PATH_PREFIX = 'live/';

export function liveStreamPath(streamKey: string): string {
  return `${LIVE_PATH_PREFIX}${streamKey}`;
}

export function streamKeyFromPath(path: string): string | null {
  if (!path.startsWith(LIVE_PATH_PREFIX)) return null;
  const key = path.slice(LIVE_PATH_PREFIX.length);
  return key.length > 0 && !key.includes('/') ? key : null;
}

/** What the next broadcast inherits: the credentials OBS holds and the settings the creator chose. */
export function liveStreamCarryOver(stream: LiveStream) {
  return {
    channelId: stream.channelId,
    title: stream.title,
    description: stream.description,
    visibility: stream.visibility,
    archiveVisibility: stream.archiveVisibility,
    chatSlowModeSeconds: stream.chatSlowModeSeconds,
    chatSubscribersOnly: stream.chatSubscribersOnly,
    streamKey: stream.streamKey,
    overlayToken: stream.overlayToken,
    controlToken: stream.controlToken,
  };
}
