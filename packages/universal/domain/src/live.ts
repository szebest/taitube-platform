import type { VideoVisibility } from './status-vocabulary';

export const LIVE_STREAM_STATUSES = ['IDLE', 'LIVE', 'ENDED'] as const;
export type LiveStreamStatus = (typeof LIVE_STREAM_STATUSES)[number];

export const LIVE_STREAM_TITLE_MAX = 100;
export const LIVE_STREAM_DESCRIPTION_MAX = 5_000;
export const LIVE_CHAT_MESSAGE_MAX = 200;
export const LIVE_CHAT_SLOW_MODE_MAX_SECONDS = 300;
export const LIVE_MARKER_LABEL_MAX = 80;

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
  videoId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The ingest path MediaMTX publishes a key on, `live/{streamKey}`. */
export const LIVE_PATH_PREFIX = 'live/';

export function liveStreamPath(streamKey: string): string {
  return `${LIVE_PATH_PREFIX}${streamKey}`;
}

export function streamKeyFromPath(path: string): string | null {
  if (!path.startsWith(LIVE_PATH_PREFIX)) return null;
  const key = path.slice(LIVE_PATH_PREFIX.length);
  return key.length > 0 && !key.includes('/') ? key : null;
}
