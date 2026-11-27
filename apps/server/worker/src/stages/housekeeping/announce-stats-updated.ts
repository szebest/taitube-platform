import { type Result, isErr, ok } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';
import { type ViewBatch, firstHoursSince, roleHas, videoStatsUpdated } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

/**
 * Tells everyone who may read a video's stats that a flush counted views for it, for videos still in
 * their first 48 hours. The event carries the id only: the open panel refetches, so a repeat
 * announcement after a replayed batch costs one request and nothing else.
 */
export async function announceStatsUpdated(
  repositories: Pick<Repositories, 'videos' | 'channelMembers' | 'userEvents'>,
  batch: Pick<ViewBatch, 'hourly'>,
  now: Date
): Promise<Result<void, DatabaseUnavailable>> {
  const readersByChannel = new Map<string, string[]>();

  const inWindow = await repositories.videos.listReadyAfter(
    [...new Set(batch.hourly.map((count) => count.videoId))],
    firstHoursSince(now)
  );
  if (isErr(inWindow)) return inWindow;

  for (const { id: videoId, ownerId, channelId } of inWindow.value) {
    let readers = readersByChannel.get(channelId);
    if (!readers) {
      const resolved = await statsReaders(repositories, ownerId, channelId);
      if (isErr(resolved)) return resolved;
      readers = resolved.value;
      readersByChannel.set(channelId, readers);
    }

    for (const userId of readers) {
      const told = await repositories.userEvents.append({ userId, ...videoStatsUpdated(videoId) });
      if (isErr(told)) return told;
    }
  }
  return ok();
}

/** The owner and the analysts on the team of the channel the video is on. */
async function statsReaders(
  repositories: Pick<Repositories, 'channelMembers'>,
  ownerId: string,
  channelId: string
): Promise<Result<string[], DatabaseUnavailable>> {
  const members = await repositories.channelMembers.listByChannel(channelId);
  if (isErr(members)) return members;
  const analysts = members.value
    .filter(({ role }) => roleHas(role, 'analytics.read'))
    .map(({ userId }) => userId);
  return ok([ownerId, ...analysts]);
}
