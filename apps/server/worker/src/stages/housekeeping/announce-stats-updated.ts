import type { Repositories } from '@vp/core/repositories';
import { type ViewBatch, inFirstHours, roleHas, videoStatsUpdated } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, isErr, ok } from '@vp/result';

/**
 * Tells everyone who may read a video's stats that a flush counted views for it, for videos still in
 * their first 48 hours. The event carries the id only: the open panel refetches, so a repeat
 * announcement after a replayed batch costs one request and nothing else.
 */
export async function announceStatsUpdated(
  repositories: Pick<Repositories, 'videos' | 'channels' | 'channelMembers' | 'userEvents'>,
  batch: Pick<ViewBatch, 'hourly'>,
  now: Date
): Promise<Result<void, DatabaseUnavailable>> {
  const readersByOwner = new Map<string, string[]>();

  for (const videoId of new Set(batch.hourly.map((count) => count.videoId))) {
    const found = await repositories.videos.findById(videoId);
    if (isErr(found)) return found;
    const video = found.value;
    if (!video?.readyAt || !inFirstHours(video.readyAt, now)) continue;

    let readers = readersByOwner.get(video.ownerId);
    if (!readers) {
      const resolved = await statsReaders(repositories, video.ownerId);
      if (isErr(resolved)) return resolved;
      readers = resolved.value;
      readersByOwner.set(video.ownerId, readers);
    }

    for (const userId of readers) {
      const told = await repositories.userEvents.append({ userId, ...videoStatsUpdated(videoId) });
      if (isErr(told)) return told;
    }
  }
  return ok();
}

async function statsReaders(
  repositories: Pick<Repositories, 'channels' | 'channelMembers'>,
  ownerId: string
): Promise<Result<string[], DatabaseUnavailable>> {
  const channel = await repositories.channels.findByUserId(ownerId);
  if (isErr(channel)) return channel;
  if (!channel.value) return ok([ownerId]);

  const members = await repositories.channelMembers.listByChannel(channel.value.id);
  if (isErr(members)) return members;
  const analysts = members.value
    .filter(({ role }) => roleHas(role, 'analytics.read'))
    .map(({ userId }) => userId);
  return ok([ownerId, ...analysts]);
}
