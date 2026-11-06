import type { Video, WatchPartyVisibility } from '@vp/domain';
import {
  type NotShareableReason,
  type WatchPartyVideoNotShareable,
  watchPartyVideoNotShareable,
} from '@vp/errors';
import { err, ok, type Result } from '@vp/result';

export type ShareableVideo = Pick<Video, 'id' | 'status' | 'visibility' | 'deletedAt'>;

function refusal(
  video: ShareableVideo | null,
  room: WatchPartyVisibility
): NotShareableReason | null {
  if (video === null || video.deletedAt) return 'missing';
  if (video.status === 'LIVE') return 'live';
  if (video.status !== 'READY') return 'not_ready';
  if (video.visibility === 'private') return 'private';
  if (video.visibility === 'unlisted' && room === 'public') return 'unlisted';
  return null;
}

/**
 * Whether a room may play a video: never a private one or a live broadcast, and an unlisted one
 * only where discovery cannot surface it. Re-checked on every advance and by the sweep.
 */
export function decideWatchPartyShareable(
  videoId: string,
  video: ShareableVideo | null,
  room: WatchPartyVisibility
): Result<ShareableVideo, WatchPartyVideoNotShareable> {
  const reason = refusal(video, room);
  return reason === null && video !== null
    ? ok(video)
    : err(watchPartyVideoNotShareable(videoId, reason ?? 'missing'));
}
