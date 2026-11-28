import type { Logger } from '@kit/logger';
import { isErr, ok, type Result } from '@kit/result';
import type { QueueJob } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import {
  mayHearAbout,
  memberKeyOf,
  WATCH_PARTY_START_GRACE_MS,
  type WatchPartyRoom,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { NotifyPartyReminderJob } from '@vp/job-contracts';
import { usersSwitchedOn } from './notification-switches';

export interface NotifyPartyReminderDeps {
  repositories: Repositories;
  logger: Logger;
  now: () => number;
}

export interface NotifyPartyReminderResult {
  roomId: string;
  recorded: number;
}

/** An account banned from the room, or without a way into a private one, is told nothing. */
async function mayStillJoin(
  repositories: Repositories,
  room: Pick<WatchPartyRoom, 'id' | 'visibility'>,
  userId: string,
  invited: boolean
): Promise<Result<boolean, DatabaseUnavailable>> {
  const memberKey = memberKeyOf({ kind: 'user', userId });
  const banned = await repositories.watchPartyMembers.isBanned(room.id, memberKey, null);
  if (isErr(banned)) return banned;
  if (banned.value) return ok(false);
  if (room.visibility !== 'private' || invited) return ok(true);
  const seat = await repositories.watchPartyMembers.find(room.id, memberKey);
  return isErr(seat) ? seat : ok(seat.value !== null && seat.value.leftAt === null);
}

/**
 * Tells the interested and the pending invitees a scheduled room is about to start. A reminder
 * enqueued for an instant the room has since left, for a closed room and for an account that
 * switched party notifications off says nothing.
 */
export function createNotifyPartyReminderProcessor(deps: NotifyPartyReminderDeps) {
  const { repositories, logger, now } = deps;

  return async function processNotifyPartyReminder(
    job: QueueJob<NotifyPartyReminderJob>
  ): Promise<Result<NotifyPartyReminderResult, DatabaseUnavailable>> {
    const { roomId, scheduledFor, lead } = job.data;
    const skipped = ok({ roomId, recorded: 0 });

    const room = await repositories.watchPartyRooms.findById(roomId);
    if (isErr(room)) return room;
    const current = room.value;
    if (!current || current.status !== 'open' || current.scheduledFor === null) return skipped;
    if (current.scheduledFor.getTime() !== new Date(scheduledFor).getTime()) return skipped;

    const interested = await repositories.watchPartyInterest.userIdsOf(roomId);
    if (isErr(interested)) return interested;
    const invites = await repositories.watchPartyInvites.listForRoom(roomId);
    if (isErr(invites)) return invites;
    const pending = new Map(
      invites.value
        .filter(({ status, expiresAt }) => status === 'pending' && expiresAt.getTime() > now())
        .map((invite) => [invite.inviteeId, invite])
    );
    const candidates = [...new Set([...interested.value, ...pending.keys()])];
    const recipients: string[] = [];
    for (const userId of candidates) {
      const mayJoin = await mayStillJoin(repositories, current, userId, pending.has(userId));
      if (isErr(mayJoin)) return mayJoin;
      if (mayJoin.value) recipients.push(userId);
    }
    if (recipients.length === 0) return skipped;

    const switchedOn = await usersSwitchedOn(repositories, recipients, 'party_starting');
    if (isErr(switchedOn)) return switchedOn;

    const { currentVideoId } = current;
    const video = currentVideoId ? await repositories.videos.findById(currentVideoId) : ok(null);
    if (isErr(video)) return video;
    const startsBy = new Date(current.scheduledFor.getTime() + WATCH_PARTY_START_GRACE_MS);

    let recorded = 0;
    for (const userId of recipients.filter((id) => switchedOn.value.has(id))) {
      const invite = pending.get(userId);
      const videoTitle =
        video.value && mayHearAbout(video.value, userId) ? video.value.title : null;
      const saved = await repositories.notifications.record({
        userId,
        kind: 'party_starting',
        actorChannelId: null,
        videoId: null,
        commentId: null,
        watchPartyId: roomId,
        groupKey: `party_starting:${roomId}:${lead}`,
        payload: {
          actor: null,
          videoTitle,
          excerpt: null,
          outcome: null,
          party: {
            roomId,
            name: current.name,
            videoTitle,
            scheduledFor,
            inviteId: invite?.id ?? null,
            expiresAt: (invite?.expiresAt ?? startsBy).toISOString(),
            watching: { names: [], count: current.presentCount },
          },
        },
      });
      if (isErr(saved)) return saved;
      recorded += saved.value === null ? 0 : 1;
    }

    logger.info({ roomId, lead, recorded }, 'reminded accounts a watch party is starting');
    return ok({ roomId, recorded });
  };
}
