import type { PartyGuestSession } from '@vp/core/ports';
import { guestName, type MemberKey, pickGuestDigits, type WatchPartyMember } from '@vp/domain';
import { decideWatchPartyJoin, type WatchPartyJoinFailure } from '@vp/domain-rules';
import { MS_PER_SECOND } from '@vp/domain/time';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  type WatchPartyInviteInvalid,
  type WatchPartyNotFound,
  watchPartyFull,
  watchPartyGuestsOff,
} from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import { joinCapacity } from './watch-party-admission';
import { consumeBudget, type RateLimited } from './watch-party-budgets';
import type { WatchPartyDeps } from './watch-party-deps';
import { claimGrant, findGrant, joinGrantOf } from './watch-party-grants';
import { announceLine, systemLineFor } from './watch-party-moderation-effects';
import { toNewSeat } from './watch-party-principals';
import { upgradeSeat } from './watch-party-seat-upgrade';
import { countJoin, inSpan } from './watch-party-telemetry';
import { type MembershipView, toMembershipView } from './watch-party-views';

export interface GuestJoinBody {
  readonly invite?: string;
}

const GUEST_NAME = /^Guest (\d+)$/;

function takenDigits(seats: readonly WatchPartyMember[]): Set<number> {
  return new Set(
    seats.flatMap(({ kind, displayName }) => {
      const digits = kind === 'guest' ? GUEST_NAME.exec(displayName ?? '')?.[1] : undefined;
      return digits === undefined ? [] : [Number(digits)];
    })
  );
}

export interface GuestJoined {
  readonly membership: MembershipView;
  readonly expiresAt: string;
  /** For the route's cookie; never part of the response body. */
  readonly credential: string;
  readonly maxAgeSeconds: number;
}

export type GuestJoinFailure =
  | WatchPartyJoinFailure
  | WatchPartyNotFound
  | WatchPartyInviteInvalid
  | RateLimited
  | CacheUnavailable
  | DatabaseUnavailable;

export class WatchPartyGuestService {
  constructor(private readonly deps: WatchPartyDeps) {}

  async join(
    roomId: string,
    caller: PartyCaller,
    body: GuestJoinBody | null | undefined
  ): Promise<Result<GuestJoined, GuestJoinFailure>> {
    return countJoin(
      this.deps,
      'guest',
      await inSpan('join', { 'room.id': roomId, 'watch_party.kind': 'guest' }, () =>
        this.attemptJoin(roomId, caller, body)
      )
    );
  }

  private async attemptJoin(
    roomId: string,
    caller: PartyCaller,
    body: GuestJoinBody | null | undefined
  ): Promise<Result<GuestJoined, GuestJoinFailure>> {
    const { deps } = this;
    const { repositories, secrets, config, gate, now } = deps;
    const loaded = await deps.context.load(roomId, caller);
    if (isErr(loaded)) return loaded;
    const { room, roles, assignments } = loaded.value;

    const ipHash = secrets.hashIp(roomId, caller.ip);
    if (ipHash === null) return err(watchPartyGuestsOff(roomId));
    const guestId = secrets.newToken();
    const memberKey: MemberKey = `guest:${guestId}`;

    const grant = await findGrant(deps, { roomId, userId: null, invite: body?.invite });
    if (isErr(grant)) return grant;
    const banned = await repositories.watchPartyMembers.isBanned(roomId, memberKey, ipHash);
    if (isErr(banned)) return banned;
    const capacity = await joinCapacity(deps, {
      room,
      memberKey: null,
      isOwner: false,
      joinWhenFull: false,
    });
    if (isErr(capacity)) return capacity;
    const decided = decideWatchPartyJoin({
      room,
      kind: 'guest',
      isMember: false,
      banned: banned.value,
      grant: joinGrantOf(grant.value),
      password: 'none',
      entry: 'link',
      capacity: capacity.value,
    });
    if (isErr(decided)) return decided;

    const perAddress = config.budgets.guestCredential;
    const credentials = await consumeBudget(gate, 'guest-credential', caller.ip, perAddress);
    if (isErr(credentials)) return credentials;
    const joins = await consumeBudget(gate, 'guest-join', roomId, config.budgets.guestJoin);
    if (isErr(joins)) return joins;

    const seated = await repositories.watchPartyMembers.listSeated(roomId);
    if (isErr(seated)) return seated;
    const digits = pickGuestDigits(takenDigits(seated.value), secrets.random);
    if (digits === null) {
      return err(watchPartyFull(roomId, capacity.value.present, capacity.value.shown));
    }
    const principal = { kind: 'guest', guestId, name: guestName(digits) } as const;

    const claimed = await claimGrant(
      deps,
      roomId,
      decided.value.via === 'invite_link' ? grant.value : { type: 'none' }
    );
    if (isErr(claimed)) return claimed;
    const credential = secrets.newToken();
    const session: PartyGuestSession = { principal, ipHash };
    const issued = await deps.guestSessions.issue(
      credential,
      session,
      config.guestCredentialTtlSeconds
    );
    if (isErr(issued)) return issued;

    const at = now();
    const line = systemLineFor(deps, room, {
      event: 'joined',
      actorKey: memberKey,
      targetKey: null,
      detail: null,
    });
    const seat = await repositories.watchPartyMembers.join(
      toNewSeat({
        roomId,
        principal,
        joinedVia: decided.value.via ?? 'link',
        joinedAt: at,
        ipHash,
      }),
      line
    );
    if (isErr(seat)) return seat;
    await announceLine(deps, roomId, line);

    const { effective } = deps.context.contextOf(room, roles, assignments, seat.value, {
      user: null,
      party: session,
      ip: caller.ip,
    });
    const lifetimeMs = config.guestCredentialTtlSeconds * MS_PER_SECOND;
    return ok({
      membership: toMembershipView(seat.value, principal.name, [], effective),
      expiresAt: new Date(at.getTime() + lifetimeMs).toISOString(),
      credential,
      maxAgeSeconds: config.guestCredentialTtlSeconds,
    });
  }

  upgrade(roomId: string, caller: PartyCaller, credential: string | null) {
    return inSpan('seat_upgrade', { 'room.id': roomId }, () =>
      upgradeSeat(this.deps, roomId, caller, credential)
    );
  }
}
