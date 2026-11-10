import type { WatchPartyClientFrame, WatchPartyServerFrame } from '@vp/api-contracts';
import { effectivePermissions, parseMemberKey, type WatchPartyPermission } from '@vp/domain';
import { requireRoomPermission } from '@vp/domain-rules';
import type {
  CacheUnavailable,
  DatabaseUnavailable,
  WatchPartyClosed,
  WatchPartyNotFound,
  WatchPartyPermissionMissing,
} from '@vp/errors';
import {
  canInRoom,
  getWatchPartyPermissions,
  toWatchPartyViewer,
  type WatchPartyAbility,
} from '@vp/permissions';
import { isErr, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import type { RoomBatcher } from './room-batcher';
import { consumeBudget, type RateLimited } from './watch-party-budgets';
import type { RoomContext } from './watch-party-context';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce } from './watch-party-moderation-effects';
import { advanceRoom } from './watch-party-playback';
import { loadSeated } from './watch-party-seated-actions';

type ReactionsFrame = Extract<WatchPartyServerFrame, { type: 'reactions' }>;
type Emoji = Extract<WatchPartyClientFrame, { type: 'react' }>['emoji'];
type RequestFrame = Extract<WatchPartyClientFrame, { type: 'request' }>;

export interface Reaction {
  readonly memberKey: string;
  readonly emoji: Emoji;
}

type SeatedFailure = WatchPartyNotFound | WatchPartyClosed | DatabaseUnavailable;

export type SignalFailure =
  | SeatedFailure
  | WatchPartyPermissionMissing
  | RateLimited
  | CacheUnavailable;

/** One window's reactions as one frame: the totals, and how many each member sent of each. */
/** @internal */
export function foldReactions(reactions: readonly Reaction[]): ReactionsFrame {
  const counts: Partial<Record<Emoji, number>> = {};
  const from = new Map<string, { memberKey: string; emoji: Emoji; count: number }>();
  for (const { memberKey, emoji } of reactions) {
    counts[emoji] = (counts[emoji] ?? 0) + 1;
    const key = `${memberKey} ${emoji}`;
    const seen = from.get(key);
    from.set(key, { memberKey, emoji, count: (seen?.count ?? 0) + 1 });
  }
  return { type: 'reactions', counts, from: [...from.values()] };
}

/** Each pod's reactions for a room, one frame per window. */
export function flushReactions(deps: Pick<WatchPartyDeps, 'broadcaster' | 'logger'>) {
  return (roomId: string, reactions: readonly Reaction[]) =>
    announce(deps, roomId, foldReactions(reactions));
}

/** Held on the socket's own ability, refreshed by every role frame, so a burst costs no reads. */
export async function react(
  deps: Pick<WatchPartyDeps, 'gate' | 'config'>,
  reactions: RoomBatcher<Reaction>,
  reaction: Reaction & { readonly roomId: string; readonly ability: WatchPartyAbility }
): Promise<Result<void, WatchPartyPermissionMissing | RateLimited | CacheUnavailable>> {
  const { roomId, memberKey, emoji, ability } = reaction;
  const held = requireRoomPermission(ability, 'chat.react');
  if (isErr(held)) return held;
  const spent = await consumeBudget(
    deps.gate,
    'reaction',
    `${roomId}:${memberKey}`,
    deps.config.budgets.reaction
  );
  if (isErr(spent)) return spent;
  reactions.add(roomId, { memberKey, emoji });
  return ok();
}

/** Reaches only the sockets whose holder may act on it. */
export async function requestPlayback(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  { kind, positionMs }: RequestFrame
): Promise<Result<void, SignalFailure>> {
  const seated = await loadSeated(deps.context, roomId, caller);
  if (isErr(seated)) return seated;
  const { context, memberKey } = seated.value;
  const held = requireRoomPermission(context.ability, 'playback.request');
  if (isErr(held)) return held;
  const spent = await consumeBudget(
    deps.gate,
    'request',
    `${roomId}:${memberKey}`,
    deps.config.budgets.request
  );
  if (isErr(spent)) return spent;
  const sent = await deps.broadcaster.toHolders(roomId, 'playback.control', {
    type: 'request',
    from: memberKey,
    kind,
    ...(positionMs === undefined ? {} : { positionMs }),
  });
  return isErr(sent) ? sent : ok();
}

function holds(
  { room, roles, assignments }: RoomContext,
  memberKey: string,
  permission: WatchPartyPermission,
  now: Date
): boolean {
  const kind = parseMemberKey(memberKey)?.kind;
  if (kind === undefined) return false;
  const isOwner = memberKey === room.ownerKey;
  const effective = effectivePermissions({
    kind,
    isOwner,
    roles,
    assignments: assignments.filter((row) => row.memberKey === memberKey),
    now,
  });
  return canInRoom(
    getWatchPartyPermissions(null, toWatchPartyViewer({ kind, isOwner, effective })),
    permission
  );
}

/**
 * One vote per member per item; the room skips once the votes reach `skip_vote_percent` of the
 * present members who may vote, rounded up.
 */
export async function voteSkip(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  itemId: string
): Promise<Result<void, SeatedFailure | WatchPartyPermissionMissing | CacheUnavailable>> {
  const seated = await loadSeated(deps.context, roomId, caller);
  if (isErr(seated)) return seated;
  const { context, memberKey } = seated.value;
  const { room } = context;
  const held = requireRoomPermission(context.ability, 'queue.vote');
  if (isErr(held)) return held;
  if (room.playback.itemId !== itemId) return ok();

  const now = deps.now();
  const present = await deps.presence.members(
    roomId,
    now.getTime() - deps.config.presence.staleAfterMs
  );
  if (isErr(present)) return present;
  const voters = present.value.filter((member) =>
    holds(context, member.memberKey, 'queue.vote', now)
  ).length;
  const votes = await deps.gate.voteSkip(roomId, itemId, memberKey);
  if (isErr(votes)) return votes;

  const needed = Math.max(1, Math.ceil((voters * room.skipVotePercent) / 100));
  await announce(deps, roomId, { type: 'votes', itemId, votes: votes.value, needed });
  if (votes.value < needed) return ok();
  const advanced = await advanceRoom(deps, room, null, 'skip');
  return isErr(advanced) ? advanced : ok();
}
