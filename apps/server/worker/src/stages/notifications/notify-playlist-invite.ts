import type { DatabaseUnavailable } from '@kit/errors';
import type { Logger } from '@kit/logger';
import type { QueueJob } from '@kit/ports';
import { type Result, isErr, ok } from '@kit/result';
import type { Repositories } from '@vp/core/repositories';
import { playlistInviteState } from '@vp/domain';
import type { NotifyPlaylistInviteJob } from '@vp/job-contracts';

export interface NotifyPlaylistInviteDeps {
  repositories: Repositories;
  logger: Logger;
  now: () => number;
}

export interface NotifyPlaylistInviteResult {
  inviteId: string;
  recorded: boolean;
}

/** Tells the invitee who asked them onto a playlist, while the personal invite can still be taken. */
export function createNotifyPlaylistInviteProcessor(deps: NotifyPlaylistInviteDeps) {
  const { repositories, logger, now } = deps;

  return async function processNotifyPlaylistInvite(
    job: QueueJob<NotifyPlaylistInviteJob>
  ): Promise<Result<NotifyPlaylistInviteResult, DatabaseUnavailable>> {
    const { inviteId } = job.data;
    const skipped = ok({ inviteId, recorded: false });

    const found = await repositories.playlistCollaborators.findInviteById(inviteId);
    if (isErr(found)) return found;
    const invite = found.value;
    if (!invite?.inviteeUserId || playlistInviteState(invite, new Date(now())) !== 'active') {
      return skipped;
    }

    const playlist = await repositories.playlists.findById(invite.playlistId);
    if (isErr(playlist)) return playlist;
    if (!playlist.value) return skipped;

    const inviter = await repositories.channels.findPrimaryByUserId(
      invite.createdBy ?? playlist.value.ownerId
    );
    if (isErr(inviter)) return inviter;

    const { id, title } = playlist.value;
    const saved = await repositories.notifications.record({
      userId: invite.inviteeUserId,
      kind: 'playlist_invite',
      actorChannelId: inviter.value?.id ?? null,
      videoId: null,
      commentId: null,
      groupKey: `playlist_invite:${inviteId}`,
      payload: {
        actor: inviter.value && {
          handle: inviter.value.handle,
          displayName: inviter.value.displayName,
          avatarUrl: inviter.value.avatarUrl,
        },
        videoTitle: null,
        excerpt: null,
        outcome: null,
        playlist: { id, title, invite: { token: invite.token, role: invite.role } },
      },
    });
    if (isErr(saved)) return saved;

    logger.info({ inviteId, playlistId: id }, 'told a user they were invited onto a playlist');
    return ok({ inviteId, recorded: saved.value !== null });
  };
}
