import type { Logger } from '@kit/logger';
import { type Result, isErr, ok } from '@kit/result';
import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import type { NotifyPlaylistUpdateJob } from '@vp/job-contracts';

export interface NotifyPlaylistUpdateDeps {
  repositories: Repositories;
  logger: Logger;
}

export interface NotifyPlaylistUpdateResult {
  playlistId: string;
  recorded: boolean;
}

/**
 * Tells the owner that someone else changed their playlist. One row per playlist: changes within
 * the grouping window fold into the unread row instead of adding to the bell.
 */
export function createNotifyPlaylistUpdateProcessor(deps: NotifyPlaylistUpdateDeps) {
  const { repositories, logger } = deps;

  return async function processNotifyPlaylistUpdate(
    job: QueueJob<NotifyPlaylistUpdateJob>
  ): Promise<Result<NotifyPlaylistUpdateResult, DatabaseUnavailable>> {
    const { playlistId, actorUserId } = job.data;
    const skipped = ok({ playlistId, recorded: false });

    const playlist = await repositories.playlists.findById(playlistId);
    if (isErr(playlist)) return playlist;
    if (!playlist.value || playlist.value.ownerId === actorUserId) return skipped;

    const actor = await repositories.channels.findPrimaryByUserId(actorUserId);
    if (isErr(actor)) return actor;

    const { ownerId, title } = playlist.value;
    const saved = await repositories.notifications.record({
      userId: ownerId,
      kind: 'playlist_update',
      actorChannelId: actor.value?.id ?? null,
      videoId: null,
      commentId: null,
      groupKey: `playlist_update:${playlistId}`,
      payload: {
        actor: actor.value && {
          handle: actor.value.handle,
          displayName: actor.value.displayName,
          avatarUrl: actor.value.avatarUrl,
        },
        videoTitle: null,
        excerpt: null,
        outcome: null,
        playlist: { id: playlistId, title, invite: null },
      },
    });
    if (isErr(saved)) return saved;

    logger.info({ playlistId, actorUserId }, 'told an owner someone changed their playlist');
    return ok({ playlistId, recorded: saved.value !== null });
  };
}
