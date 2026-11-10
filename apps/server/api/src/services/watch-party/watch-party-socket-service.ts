import type { WatchPartyTicketGrant } from '@vp/core/ports';
import { admissionLimit, effectiveCapacity, memberKeyOf, type MemberKind } from '@vp/domain';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  ErrorCodes,
  type Failure,
  type WatchPartyBanned,
  type WatchPartyClosed,
  type WatchPartyFull,
  type WatchPartyNotFound,
  type WatchPartyTicketInvalid,
  watchPartyBanned,
  watchPartyClosed,
  watchPartyFull,
  watchPartyNotFound,
  watchPartyTicketInvalid,
} from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { PatternHub } from '../pattern-hub';
import type { PartyCaller } from './party-caller';
import type { RoomBatcher } from './room-batcher';
import { holdsJoinWhenFull, isRoomMember } from './watch-party-admission';
import type { RoomEnvelope } from './watch-party-broadcaster';
import type { BufferingWait } from './watch-party-buffering';
import { type ConnectionIo, RoomConnection } from './watch-party-connection';
import type { WatchPartyDeps } from './watch-party-deps';
import type { OwnerGrace } from './watch-party-owner-grace';
import type { RosterChange } from './watch-party-roster-feed';
import type { Reaction } from './watch-party-signals';

/** What the room socket adds to every watch party service's collaborators: one of each per pod. */
export interface RoomSocketDeps extends WatchPartyDeps {
  readonly hub: PatternHub<RoomEnvelope>;
  /** `CORS_ORIGINS`: a browser socket from anywhere else is refused, as its fetches would be. */
  readonly allowedOrigins: readonly string[];
  readonly reactions: RoomBatcher<Reaction>;
  readonly roster: RoomBatcher<RosterChange>;
  readonly buffering: BufferingWait;
  readonly ownerGrace: OwnerGrace;
}

/** Who a socket is, admitted to the room's presence before the upgrade. */
export interface RoomSession {
  readonly roomId: string;
  readonly caller: PartyCaller;
  readonly memberKey: string;
  readonly kind: MemberKind;
}

type OriginRefused = Failure<typeof ErrorCodes.FORBIDDEN, { origin: string }>;

type OpenFailure =
  | OriginRefused
  | WatchPartyTicketInvalid
  | WatchPartyNotFound
  | WatchPartyBanned
  | WatchPartyClosed
  | WatchPartyFull
  | CacheUnavailable
  | DatabaseUnavailable;

export type ConnectFailure = WatchPartyNotFound | CacheUnavailable | DatabaseUnavailable;

function callerOf({ principal, role }: WatchPartyTicketGrant): PartyCaller {
  return principal.kind === 'user'
    ? { user: { id: principal.userId, role: role ?? 'USER' }, party: null, ip: '' }
    : { user: null, party: { principal, ipHash: null }, ip: '' };
}

export class WatchPartySocketService {
  constructor(private readonly deps: RoomSocketDeps) {}

  /**
   * Runs before the upgrade, so a refusal is a plain HTTP Problem rather than a dead socket: the
   * one-time token, the seat, a ban, the phase, then a spot in the room's presence.
   */
  async open(input: {
    roomId: string;
    ticket?: string;
    origin?: string;
  }): Promise<Result<RoomSession, OpenFailure>> {
    const { deps } = this;
    const { roomId, ticket, origin } = input;
    if (origin !== undefined && !deps.allowedOrigins.includes(origin)) {
      return err<OriginRefused>({
        code: ErrorCodes.FORBIDDEN,
        message: 'Origin not allowed',
        origin,
      });
    }
    if (ticket === undefined) return err(watchPartyTicketInvalid());
    const grant = await deps.gate.redeemTicket(ticket);
    if (isErr(grant)) return grant;
    if (grant.value?.roomId !== roomId) return err(watchPartyTicketInvalid());

    const caller = callerOf(grant.value);
    const memberKey = memberKeyOf(grant.value.principal);
    const loaded = await deps.context.load(roomId, caller);
    if (isErr(loaded)) return loaded;
    const context = loaded.value;
    const banned = await deps.repositories.watchPartyMembers.isBanned(roomId, memberKey, null);
    if (isErr(banned)) return banned;
    if (banned.value) return err(watchPartyBanned(roomId));
    if (!isRoomMember(context)) return err(watchPartyNotFound(roomId));
    if (context.room.status === 'closed') return err(watchPartyClosed(roomId));

    const { config, presence, now } = deps;
    const nowMs = now().getTime();
    const limit = admissionLimit(context.room.capacity, config.maxMembers, {
      isOwner: context.isOwner,
      joinWhenFull: holdsJoinWhenFull(context, now()),
    });
    const admitted = await presence.admit(roomId, memberKey, {
      limit,
      nowMs,
      staleBeforeMs: nowMs - config.presence.staleAfterMs,
    });
    if (isErr(admitted)) return admitted;
    if (admitted.value.type === 'full') {
      const shown = effectiveCapacity(context.room.capacity, config.maxMembers);
      return err(watchPartyFull(roomId, admitted.value.present, shown));
    }
    const session: RoomSession = { roomId, caller, memberKey, kind: grant.value.principal.kind };
    return ok(session);
  }

  /**
   * Joins the hub before reading the snapshot, so a frame published in between arrives either
   * way; the snapshot and the chat backlog go out first, then what came during it, each once.
   */
  async connect(
    session: RoomSession,
    after: string | null,
    io: ConnectionIo
  ): Promise<Result<RoomConnection, ConnectFailure>> {
    const { deps } = this;
    const subscribed = await deps.hub.init();
    if (isErr(subscribed)) return subscribed;

    const held: RoomEnvelope[] = [];
    let connection: RoomConnection | null = null;
    const leaveHub = deps.hub.join(session.roomId, (envelope) => {
      if (connection === null) held.push(envelope);
      else connection.deliver(envelope);
    });

    const opened = await RoomConnection.open(deps, {
      session,
      id: uuidv7(),
      after,
      io,
      leaveHub,
    });
    if (isErr(opened)) {
      leaveHub();
      return opened;
    }
    const sent = new Set(opened.value.sentLines);
    for (const envelope of held) {
      if (!(envelope.frame.type === 'chat.message' && sent.has(envelope.frame.message.id))) {
        opened.value.connection.deliver(envelope);
      }
    }
    connection = opened.value.connection;
    return ok(connection);
  }
}
