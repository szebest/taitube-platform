import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import type { NotifyTeamInviteJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { isErr, ok, type Result } from '@vp/result';

export interface NotifyTeamInviteDeps {
  repositories: Repositories;
  logger: Logger;
}

export interface NotifyTeamInviteResult {
  inviteId: string;
  recorded: boolean;
}

/** Tells the invitee that a channel invited them to its team, while the invite is still pending. */
export function createNotifyTeamInviteProcessor(deps: NotifyTeamInviteDeps) {
  const { repositories, logger } = deps;

  return async function processNotifyTeamInvite(
    job: QueueJob<NotifyTeamInviteJob>
  ): Promise<Result<NotifyTeamInviteResult, DatabaseUnavailable>> {
    const { inviteId } = job.data;
    const skipped = ok({ inviteId, recorded: false });

    const invite = await repositories.channelInvites.findById(inviteId);
    if (isErr(invite)) return invite;
    if (invite.value?.status !== 'pending') return skipped;

    const channel = await repositories.channels.findById(invite.value.channelId);
    if (isErr(channel)) return channel;
    if (!channel.value) return skipped;

    const { id, handle, displayName, avatarUrl } = channel.value;
    const saved = await repositories.notifications.record({
      userId: invite.value.inviteeUserId,
      kind: 'team_invite',
      actorChannelId: id,
      videoId: null,
      commentId: null,
      groupKey: null,
      payload: {
        actor: { handle, displayName, avatarUrl },
        videoTitle: null,
        excerpt: null,
        outcome: null,
      },
    });
    if (isErr(saved)) return saved;

    logger.info({ inviteId }, 'told a user a channel invited them to its team');
    return ok({ inviteId, recorded: saved.value !== null });
  };
}
