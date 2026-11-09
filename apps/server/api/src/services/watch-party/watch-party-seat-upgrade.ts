import { memberKeyOf, type MemberKey } from '@vp/domain';
import { decideWatchPartySeatUpgrade } from '@vp/domain-rules';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  ErrorCodes,
  type WatchPartyBanned,
  type WatchPartyCredentialInvalid,
  type WatchPartyNotFound,
  watchPartyNotFound,
} from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import type { WatchPartyDeps } from './watch-party-deps';
import { announce, logChange, systemLineFor } from './watch-party-moderation-effects';
import { resolvePeople } from './watch-party-names';
import { requirePrincipal, type Unauthenticated } from './watch-party-principals';
import { heldRoleIds, type MembershipView, toMembershipView } from './watch-party-views';

export type UpgradeFailure =
  | Unauthenticated
  | WatchPartyNotFound
  | WatchPartyCredentialInvalid
  | WatchPartyBanned
  | CacheUnavailable
  | DatabaseUnavailable;

interface UpgradeFacts {
  readonly pair: { guestKey: MemberKey; accountKey: MemberKey; userId: string } | null;
  readonly guestSeat: boolean;
  readonly hasSeat: boolean;
  readonly banned: boolean;
}

async function upgradeFacts(
  { repositories }: Pick<WatchPartyDeps, 'repositories'>,
  roomId: string,
  caller: PartyCaller
): Promise<Result<UpgradeFacts, DatabaseUnavailable>> {
  const { watchPartyMembers } = repositories;
  const { user, party } = caller;
  const guest = party?.principal.kind === 'guest' ? party : null;
  const guestKey = guest === null ? null : memberKeyOf(guest.principal);
  const accountKey = user === null ? null : memberKeyOf({ kind: 'user', userId: user.id });

  const guestSeat = guestKey === null ? ok(null) : await watchPartyMembers.find(roomId, guestKey);
  if (isErr(guestSeat)) return guestSeat;
  const accountSeat =
    accountKey === null ? ok(null) : await watchPartyMembers.find(roomId, accountKey);
  if (isErr(accountSeat)) return accountSeat;
  const guestBanned =
    guestKey === null
      ? ok(false)
      : await watchPartyMembers.isBanned(roomId, guestKey, guest?.ipHash ?? null);
  if (isErr(guestBanned)) return guestBanned;
  const accountBanned =
    accountKey === null ? ok(false) : await watchPartyMembers.isBanned(roomId, accountKey, null);
  if (isErr(accountBanned)) return accountBanned;

  return ok({
    pair:
      guestKey !== null && accountKey !== null && user !== null
        ? { guestKey, accountKey, userId: user.id }
        : null,
    guestSeat: guestSeat.value?.leftAt === null,
    hasSeat: accountSeat.value?.leftAt === null,
    banned: guestBanned.value || accountBanned.value,
  });
}

export async function upgradeSeat(
  deps: WatchPartyDeps,
  roomId: string,
  caller: PartyCaller,
  credential: string | null
): Promise<Result<{ membership: MembershipView }, UpgradeFailure>> {
  const { repositories, now } = deps;
  const signedIn = requirePrincipal(caller, 'upgrade a seat');
  if (isErr(signedIn)) return signedIn;
  const loaded = await deps.context.load(roomId, caller);
  if (isErr(loaded)) return loaded;
  const context = loaded.value;
  const facts = await upgradeFacts(deps, roomId, caller);
  if (isErr(facts)) return facts;
  const { pair, guestSeat, hasSeat, banned } = facts.value;

  const decided = decideWatchPartySeatUpgrade({
    roomId,
    guestSeat,
    next: caller.user === null ? 'guest' : 'user',
    banned,
    hasSeat,
  });
  if (isErr(decided)) {
    const refused = decided.error.code === ErrorCodes.WATCH_PARTY_BANNED && pair !== null;
    if (refused) {
      const left = await repositories.watchPartyMembers.leave(
        roomId,
        pair.guestKey,
        systemLineFor(deps, context.room, {
          event: 'left',
          actorKey: pair.guestKey,
          targetKey: null,
          detail: null,
        }),
        now()
      );
      if (isErr(left)) return left;
      const gone = await deps.presence.leave(roomId, pair.guestKey);
      if (isErr(gone)) return gone;
    }
    return decided;
  }
  if (pair === null) return err(watchPartyNotFound(roomId));

  const at = now();
  const moved = await repositories.watchPartyMembers.moveSeat({
    roomId,
    fromKey: pair.guestKey,
    to: {
      memberKey: pair.accountKey,
      kind: 'user',
      userId: pair.userId,
      discordUserId: null,
      displayName: null,
      avatarUrl: null,
    },
    at,
  });
  if (isErr(moved)) return moved;
  if (moved.value === null) return err(watchPartyNotFound(roomId));
  const revoked = credential === null ? ok() : await deps.guestSessions.revoke(credential);
  if (isErr(revoked)) return revoked;

  const carried = await repositories.watchPartyRoles.assignmentsOf(roomId, pair.accountKey);
  if (isErr(carried)) return carried;
  const roleIds = heldRoleIds(carried.value, pair.accountKey, at);
  await announce(
    deps,
    roomId,
    { type: 'you', memberKey: pair.accountKey, kind: 'user', roleIds },
    pair.guestKey
  );
  logChange(deps, {
    roomId,
    actorKey: pair.accountKey,
    action: 'seat upgrade',
    targetKey: pair.guestKey,
  });
  deps.metrics.watchPartySeatUpgradesTotal.inc({ to: 'user' });

  const people = await resolvePeople(
    repositories.channels,
    [pair.accountKey],
    new Map([[pair.accountKey, moved.value]])
  );
  if (isErr(people)) return people;
  const { effective } = deps.context.contextOf(
    context.room,
    context.roles,
    carried.value,
    moved.value,
    { user: caller.user, party: null, ip: caller.ip }
  );
  return ok({
    membership: toMembershipView(
      moved.value,
      people.value(pair.accountKey).name,
      roleIds,
      effective
    ),
  });
}
