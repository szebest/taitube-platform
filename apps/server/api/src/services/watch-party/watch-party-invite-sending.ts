import {
  memberKeyOf,
  type RosterPreviewMember,
  toRosterPreview,
  WATCH_PARTY_LIMITS,
  type WatchingSnapshot,
  type WatchPartyInvite,
  type WatchPartyMember,
  type WatchPartyRoom,
} from '@vp/domain';
import type { UserPreferences } from '@vp/domain/settings';
import type { DatabaseUnavailable } from '@vp/errors';
import { partyInviteOutbox } from '@vp/job-contracts';
import { isErr, map, ok, type Result } from '@vp/result';
import type { WatchPartyDeps } from './watch-party-deps';
import {
  acceptsPartyInvite,
  inviteExpiry,
  notificationsOf,
  privacyOf,
} from './watch-party-invite-delivery';
import { resolvePeople } from './watch-party-names';

export interface InviteOutcome {
  sent: { userId: string; inviteId: string }[];
  folded: { userId: string }[];
  refused: { userId: string }[];
}

type SendingDeps = Pick<WatchPartyDeps, 'repositories' | 'secrets' | 'now'>;

/** Who is watching, as far as each allows it, frozen into an invite when it is sent. */
async function watchingSnapshot(
  { repositories }: SendingDeps,
  room: WatchPartyRoom,
  seated: readonly WatchPartyMember[],
  preferences: ReadonlyMap<string, UserPreferences>
): Promise<Result<WatchingSnapshot, DatabaseUnavailable>> {
  const people = await resolvePeople(
    repositories.channels,
    seated.map(({ memberKey }) => memberKey),
    new Map(seated.map((seat) => [seat.memberKey, seat]))
  );
  return map(people, (personOf) => {
    const members: RosterPreviewMember[] = seated.map((seat) => ({
      kind: seat.kind,
      name: personOf(seat.memberKey).name,
      avatarUrl: personOf(seat.memberKey).avatarUrl,
      showInParties: seat.userId !== null && privacyOf(preferences.get(seat.userId)).showInParties,
    }));
    const preview = toRosterPreview(members, room.visibility, 'invite');
    return { names: preview.faces.map(({ name }) => name), count: preview.total };
  });
}

/**
 * One invite per invitee their settings, a block and their seat allow, each with its notification
 * in the outbox; an invitee already invited is folded, and one past the room's pending limit is
 * refused with the rest, without a reason.
 */
export async function sendInvites(
  deps: SendingDeps,
  room: WatchPartyRoom,
  inviterId: string,
  invitees: readonly string[]
): Promise<Result<InviteOutcome, DatabaseUnavailable>> {
  const { repositories, secrets, now } = deps;
  const at = now();
  const seated = await repositories.watchPartyMembers.listSeated(room.id);
  if (isErr(seated)) return seated;
  const seatedUserIds = new Set(seated.value.flatMap(({ userId }) => userId ?? []));

  const [accounts, preferences, blocking, pending] = await Promise.all([
    repositories.channels.findByUserIds([inviterId, ...invitees]),
    repositories.userPreferences.findMany([...seatedUserIds, ...invitees]),
    repositories.watchPartyControls.blockingInvitesFrom(
      memberKeyOf({ kind: 'user', userId: inviterId }),
      invitees
    ),
    repositories.watchPartyInvites.countPending(room.id, at),
  ]);
  if (isErr(accounts)) return accounts;
  if (isErr(preferences)) return preferences;
  if (isErr(blocking)) return blocking;
  if (isErr(pending)) return pending;

  const inviterChannel = accounts.value.find(({ userId }) => userId === inviterId);
  const known = new Set(accounts.value.map(({ userId }) => userId));
  const byUser = new Map(preferences.value.map((row) => [row.userId, row]));
  const watching = await watchingSnapshot(deps, room, seated.value, byUser);
  if (isErr(watching)) return watching;

  const outcome: InviteOutcome = { sent: [], folded: [], refused: [] };
  let spaceLeft = Math.max(0, WATCH_PARTY_LIMITS.pendingInvitesPerRoom - pending.value);
  for (const inviteeId of invitees) {
    const subscribed =
      inviterChannel === undefined
        ? ok(false)
        : await repositories.subscriptions.isSubscribed(inviteeId, inviterChannel.id);
    if (isErr(subscribed)) return subscribed;
    const wanted =
      known.has(inviteeId) &&
      acceptsPartyInvite({
        notifications: notificationsOf(byUser.get(inviteeId)),
        subscribesToInviter: subscribed.value,
        blocksInviter: blocking.value.has(inviteeId),
        alreadySeated: seatedUserIds.has(inviteeId),
      });
    const existing = wanted
      ? await repositories.watchPartyInvites.findValid(room.id, inviteeId, at)
      : ok(null);
    if (isErr(existing)) return existing;
    if (!wanted || (existing.value === null && spaceLeft === 0)) {
      outcome.refused.push({ userId: inviteeId });
      continue;
    }
    const invite: WatchPartyInvite = {
      id: secrets.newId(),
      roomId: room.id,
      inviterId,
      inviteeId,
      status: 'pending',
      watching: watching.value,
      expiresAt: inviteExpiry(at, room.scheduledFor),
      createdAt: at,
    };
    const written = await repositories.watchPartyInvites.create(
      invite,
      partyInviteOutbox({ inviteId: invite.id })
    );
    if (isErr(written)) return written;
    if (written.value.type === 'sent') {
      spaceLeft -= 1;
      outcome.sent.push({ userId: inviteeId, inviteId: written.value.invite.id });
    } else {
      outcome.folded.push({ userId: inviteeId });
    }
  }
  return ok(outcome);
}
