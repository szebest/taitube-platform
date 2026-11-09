import type {
  CreateWatchPartyBody,
  PatchWatchPartyBody,
  WatchPartyPreviewView,
  WatchPartyView,
} from '@vp/api-contracts';
import { memberKeyOf, type RosterEntry, type RosterPreview } from '@vp/domain';
import { type AuthorizationFailure, authorize } from '@vp/domain-rules';
import { MS_PER_SECOND } from '@vp/domain/time';
import {
  type CacheUnavailable,
  type DatabaseUnavailable,
  type WatchPartyBanned,
  type WatchPartyClosed,
  type WatchPartyNotFound,
  watchPartyBanned,
  watchPartyClosed,
  watchPartyNotFound,
} from '@vp/errors';
import { all, err, isErr, map, ok, type Result } from '@vp/result';
import type { PartyCaller } from './party-caller';
import { isRoomMember } from './watch-party-admission';
import { createRoom } from './watch-party-create';
import type { WatchPartyDeps } from './watch-party-deps';
import { type JoinWatchPartyInput, joinRoom, leaveRoom } from './watch-party-join';
import {
  type PreviewFailure,
  previewRoom,
  roomAccessOf,
  rosterPreviewOf,
} from './watch-party-preview';
import { ipHashOf, requirePrincipal, type Unauthenticated } from './watch-party-principals';
import { seatedRoster } from './watch-party-room-snapshot';
import { presentRooms } from './watch-party-room-views';
import { closeRoom, updateRoom } from './watch-party-settings';

type RosterResult =
  | { readonly view: 'members'; readonly entries: RosterEntry[]; readonly guests: number }
  | { readonly view: 'preview'; readonly preview: RosterPreview };

interface MyRooms {
  readonly owning: WatchPartyView[];
  readonly joined: WatchPartyView[];
  readonly interested: WatchPartyView[];
}

interface SocketTicket {
  readonly ticket: string;
  readonly expiresAt: string;
}

type SocketTicketFailure =
  | Unauthenticated
  | WatchPartyNotFound
  | WatchPartyBanned
  | WatchPartyClosed
  | CacheUnavailable
  | DatabaseUnavailable;

export class WatchPartyService {
  constructor(private readonly deps: WatchPartyDeps) {}

  create(caller: PartyCaller, body: CreateWatchPartyBody) {
    return createRoom(this.deps, caller, body);
  }

  update(roomId: string, caller: PartyCaller, body: PatchWatchPartyBody) {
    return updateRoom(this.deps, roomId, caller, body);
  }

  close(roomId: string, caller: PartyCaller) {
    return closeRoom(this.deps, roomId, caller);
  }

  join(roomId: string, caller: PartyCaller, body: JoinWatchPartyInput | null | undefined) {
    return joinRoom(this.deps, roomId, caller, body);
  }

  leave(roomId: string, caller: PartyCaller) {
    return leaveRoom(this.deps, roomId, caller);
  }

  async get(
    roomId: string,
    caller: PartyCaller,
    invite: string | undefined
  ): Promise<Result<WatchPartyPreviewView, PreviewFailure>> {
    const loaded = await this.deps.context.load(roomId, caller);
    if (isErr(loaded)) return loaded;
    return previewRoom(this.deps, loaded.value, invite);
  }

  async roster(roomId: string, caller: PartyCaller): Promise<Result<RosterResult, PreviewFailure>> {
    const { deps } = this;
    const loaded = await deps.context.load(roomId, caller);
    if (isErr(loaded)) return loaded;
    const context = loaded.value;
    const { room } = context;

    if (context.seat === null) {
      const access = await roomAccessOf(deps, context, undefined);
      if (isErr(access)) return access;
      const preview = await rosterPreviewOf(deps, room);
      return isErr(preview) ? preview : ok({ view: 'preview' as const, preview: preview.value });
    }

    const roster = await seatedRoster(deps, context);
    return map(roster, ({ entries, guests }) => ({ view: 'members' as const, entries, guests }));
  }

  async listMine(
    caller: PartyCaller
  ): Promise<Result<MyRooms, AuthorizationFailure | DatabaseUnavailable>> {
    const { deps } = this;
    const { repositories } = deps;
    const actor = authorize(caller.user, true, { action: 'list', subject: 'WatchParty' });
    if (isErr(actor)) return actor;
    const owned = await repositories.watchPartyRooms.listOpenOwnedBy(
      memberKeyOf({ kind: 'user', userId: actor.value.id })
    );
    if (isErr(owned)) return owned;
    const seated = await repositories.watchPartyMembers.openRoomIdsOf(actor.value.id);
    if (isErr(seated)) return seated;

    const ownedIds = new Set(owned.value.map(({ id }) => id));
    const found = all(
      await Promise.all(
        seated.value
          .filter((id) => !ownedIds.has(id))
          .map((id) => repositories.watchPartyRooms.findById(id))
      )
    );
    if (isErr(found)) return found;

    const owning = await presentRooms(deps, owned.value);
    if (isErr(owning)) return owning;
    const joined = await presentRooms(
      deps,
      found.value.flatMap((room) => room ?? [])
    );
    if (isErr(joined)) return joined;
    return ok({ owning: owning.value, joined: joined.value, interested: [] });
  }

  async socketTicket(
    roomId: string,
    caller: PartyCaller
  ): Promise<Result<SocketTicket, SocketTicketFailure>> {
    const { deps } = this;
    const { gate, config, secrets, repositories } = deps;
    const principal = requirePrincipal(caller, 'open the room socket');
    if (isErr(principal)) return principal;
    const loaded = await deps.context.load(roomId, caller);
    if (isErr(loaded)) return loaded;
    const { room, memberKey } = loaded.value;

    const banned = await repositories.watchPartyMembers.isBanned(
      roomId,
      memberKeyOf(principal.value),
      ipHashOf(caller)
    );
    if (isErr(banned)) return banned;
    if (banned.value) return err(watchPartyBanned(roomId));
    if (memberKey === null || !isRoomMember(loaded.value)) return err(watchPartyNotFound(roomId));
    if (room.status === 'closed') return err(watchPartyClosed(roomId));

    const ticket = secrets.newToken();
    const issued = await gate.issueTicket(
      ticket,
      { roomId, principal: principal.value, role: caller.user?.role ?? null },
      config.ticketTtlSeconds
    );
    if (isErr(issued)) return issued;
    return ok({
      ticket,
      expiresAt: new Date(
        deps.now().getTime() + config.ticketTtlSeconds * MS_PER_SECOND
      ).toISOString(),
    });
  }
}
