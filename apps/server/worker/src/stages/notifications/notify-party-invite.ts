import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { mayHearAbout, type NotificationActor } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { NotifyPartyInviteJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { isErr, ok, type Result } from '@vp/result';
import { usersSwitchedOn } from './notification-switches';

export interface NotifyPartyInviteDeps {
  repositories: Repositories;
  logger: Logger;
  now: () => number;
}

export interface NotifyPartyInviteResult {
  inviteId: string;
  recorded: boolean;
}

/**
 * Tells an invitee they were invited, while the invite still stands: a revoked, declined or
 * expired invite, a closed room and an invitee who switched party notifications off say nothing.
 */
export function createNotifyPartyInviteProcessor(deps: NotifyPartyInviteDeps) {
  const { repositories, logger, now } = deps;

  return async function processNotifyPartyInvite(
    job: QueueJob<NotifyPartyInviteJob>
  ): Promise<Result<NotifyPartyInviteResult, DatabaseUnavailable>> {
    const { inviteId } = job.data;
    const skipped = ok({ inviteId, recorded: false });

    const invite = await repositories.watchPartyInvites.findById(inviteId);
    if (isErr(invite)) return invite;
    if (!invite.value) return skipped;
    const { inviteeId, inviterId, roomId, expiresAt, watching } = invite.value;
    if (invite.value.status !== 'pending' || expiresAt.getTime() <= now()) return skipped;

    const room = await repositories.watchPartyRooms.findById(roomId);
    if (isErr(room)) return room;
    if (!room.value || room.value.status !== 'open') return skipped;

    const switchedOn = await usersSwitchedOn(repositories, [inviteeId], 'party_invite');
    if (isErr(switchedOn)) return switchedOn;
    if (!switchedOn.value.has(inviteeId)) return skipped;

    const inviter = await repositories.channels.findByUserId(inviterId);
    if (isErr(inviter)) return inviter;
    const actor: NotificationActor | null = inviter.value && {
      handle: inviter.value.handle,
      displayName: inviter.value.displayName,
      avatarUrl: inviter.value.avatarUrl,
    };

    const { currentVideoId } = room.value;
    const video = currentVideoId ? await repositories.videos.findById(currentVideoId) : ok(null);
    if (isErr(video)) return video;
    const videoTitle =
      video.value && mayHearAbout(video.value, inviteeId) ? video.value.title : null;

    const saved = await repositories.notifications.record({
      userId: inviteeId,
      kind: 'party_invite',
      actorChannelId: inviter.value?.id ?? null,
      videoId: null,
      commentId: null,
      watchPartyId: roomId,
      groupKey: `party_invite:${roomId}`,
      payload: {
        actor,
        videoTitle,
        excerpt: null,
        outcome: null,
        party: {
          roomId,
          name: room.value.name,
          videoTitle,
          scheduledFor: room.value.scheduledFor?.toISOString() ?? null,
          inviteId,
          expiresAt: expiresAt.toISOString(),
          watching: { names: [...watching.names], count: watching.count },
        },
      },
    });
    if (isErr(saved)) return saved;

    logger.info({ inviteId, roomId }, 'told an account they were invited to a watch party');
    return ok({ inviteId, recorded: saved.value !== null });
  };
}
