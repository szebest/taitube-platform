import type { QueueSnapshot } from '@vp/core/repositories';
import type { WatchPartyRoom } from '@vp/domain';
import { decideWatchPartyShareable } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';
import { announceLine } from './watch-party-moderation-effects';

type AvailabilityDeps = Pick<
  WatchPartyDeps,
  'repositories' | 'broadcaster' | 'logger' | 'now' | 'secrets'
>;

export interface AvailabilityCheck {
  readonly queue: QueueSnapshot;
  readonly removed: number;
}

/**
 * Takes every unplayed item whose video the room may no longer play off the queue, each with a
 * "video unavailable" line, and answers the queue as it now stands.
 */
export async function dropUnavailable(
  deps: AvailabilityDeps,
  room: Pick<WatchPartyRoom, 'id' | 'visibility'>
): Promise<Result<AvailabilityCheck, DatabaseUnavailable>> {
  const { repositories, now, secrets } = deps;
  const listed = await repositories.watchPartyQueue.list(room.id);
  if (isErr(listed)) return listed;

  let queue = listed.value;
  let removed = 0;
  for (const item of listed.value.items) {
    if (item.playedAt !== null) continue;
    const video = await repositories.videos.findById(item.videoId);
    if (isErr(video)) return video;
    if (decideWatchPartyShareable(item.videoId, video.value, room.visibility).ok) continue;

    const at = now();
    const line = {
      id: secrets.newId(),
      line: { event: 'video_unavailable', actorKey: null, targetKey: null, detail: item.videoId },
      videoId: item.videoId,
      positionMs: 0,
      createdAt: at,
    } as const;
    const written = await repositories.watchPartyQueue.remove(room.id, item.id, line, at);
    if (isErr(written)) return written;
    if (written.value.type !== 'applied') continue;
    queue = written.value.queue;
    removed += 1;
    await announceLine(deps, room.id, line);
  }
  return ok({ queue, removed });
}
