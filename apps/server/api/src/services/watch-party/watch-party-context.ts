import type { Repositories } from '@vp/core/repositories';
import {
  type EffectivePermissions,
  effectivePermissions,
  type MemberKind,
  type RoomRole,
  upgradeRoomRoles,
  WATCH_PARTY_PERMISSIONS_VERSION,
  type WatchPartyMember,
  type WatchPartyMemberRole,
  type WatchPartyRoleRecord,
  type WatchPartyRoom,
} from '@vp/domain';
import { type DatabaseUnavailable, type WatchPartyNotFound, watchPartyNotFound } from '@vp/errors';
import {
  getWatchPartyPermissions,
  toWatchPartyViewer,
  type WatchPartyAbility,
} from '@vp/permissions';
import { andThen, andThenAsync, err, map, ok, type Result } from '@vp/result';
import { memberKeyOfCaller, type PartyCaller, principalOf } from './party-caller';

/** A room as one caller sees it: their seat, their roles and the ability built from them. */
export interface RoomContext {
  readonly room: WatchPartyRoom;
  readonly roles: readonly (WatchPartyRoleRecord & { readonly memberCount: number })[];
  readonly assignments: readonly WatchPartyMemberRole[];
  readonly caller: PartyCaller;
  readonly memberKey: string | null;
  readonly kind: MemberKind | null;
  /** The caller's held seat; `null` without one. */
  readonly seat: WatchPartyMember | null;
  readonly isOwner: boolean;
  readonly effective: EffectivePermissions;
  readonly ability: WatchPartyAbility;
}

type ContextRepositories = Pick<
  Repositories,
  'watchPartyRooms' | 'watchPartyRoles' | 'watchPartyMembers'
>;

const NO_SEAT: EffectivePermissions = { permissions: [], topPosition: -1 };

/** The one place a room, its roles and the caller's seat become a decision-ready context. */
export class WatchPartyContextLoader {
  constructor(
    private readonly deps: { readonly repositories: ContextRepositories; readonly now: () => Date }
  ) {}

  async load(
    roomId: string,
    caller: PartyCaller
  ): Promise<Result<RoomContext, WatchPartyNotFound | DatabaseUnavailable>> {
    const { watchPartyRooms } = this.deps.repositories;
    const found = await watchPartyRooms.findById(roomId);
    return andThenAsync(
      found,
      async (room): Promise<Result<RoomContext, WatchPartyNotFound | DatabaseUnavailable>> => {
        if (room === null) return err(watchPartyNotFound(roomId));
        const upgraded = await this.upgraded(room);
        return andThenAsync(upgraded, (current) => this.build(current, caller));
      }
    );
  }

  /** The caller's view of the room after a change, built from rows already in hand. */
  contextOf(
    room: WatchPartyRoom,
    roles: RoomContext['roles'],
    assignments: readonly WatchPartyMemberRole[],
    seat: WatchPartyMember | null,
    caller: PartyCaller
  ): RoomContext {
    const memberKey = memberKeyOfCaller(caller);
    const kind = principalOf(caller)?.kind ?? null;
    const isOwner = memberKey !== null && memberKey === room.ownerKey;
    const held = seat?.leftAt === null ? seat : null;
    const viewerSeat =
      kind !== null && (held !== null || isOwner)
        ? {
            kind,
            isOwner,
            effective: effectivePermissions({
              kind,
              isOwner,
              roles,
              assignments: assignments.filter((row) => row.memberKey === memberKey),
              now: this.deps.now(),
            }),
          }
        : null;
    const effective = viewerSeat?.effective ?? NO_SEAT;
    return {
      room,
      roles,
      assignments,
      caller,
      memberKey,
      kind,
      seat: held,
      isOwner,
      effective,
      ability: getWatchPartyPermissions(caller.user, toWatchPartyViewer(viewerSeat)),
    };
  }

  private async build(
    room: WatchPartyRoom,
    caller: PartyCaller
  ): Promise<Result<RoomContext, DatabaseUnavailable>> {
    const { watchPartyRoles, watchPartyMembers } = this.deps.repositories;
    const memberKey = memberKeyOfCaller(caller);
    const [roles, assignments, seat] = await Promise.all([
      watchPartyRoles.list(room.id, this.deps.now()),
      watchPartyRoles.assignmentsIn(room.id),
      memberKey === null ? Promise.resolve(ok(null)) : watchPartyMembers.find(room.id, memberKey),
    ]);
    return andThen(roles, (roleRows) =>
      andThen(assignments, (assignmentRows) =>
        map(seat, (seatRow) => this.contextOf(room, roleRows, assignmentRows, seatRow, caller))
      )
    );
  }

  /** A room whose roles predate the registry gains the new permissions on load, once. */
  private async upgraded(
    room: WatchPartyRoom
  ): Promise<Result<WatchPartyRoom, DatabaseUnavailable>> {
    if (room.permissionsVersion >= WATCH_PARTY_PERMISSIONS_VERSION) return ok(room);
    const { watchPartyRooms, watchPartyRoles } = this.deps.repositories;
    const roles = await watchPartyRoles.list(room.id, this.deps.now());
    return andThenAsync(roles, async (current) => {
      const { roles: next, version } = upgradeRoomRoles<RoomRole>(current, room.permissionsVersion);
      const changed = next.filter((role, index) => role !== current[index]);
      const written = await watchPartyRooms.upgradeRoles(
        room.id,
        changed.map(({ id, permissions }) => ({ id, permissions })),
        room.permissionsVersion,
        version
      );
      return andThenAsync(written, async () => {
        const reread = await watchPartyRooms.findById(room.id);
        return map(reread, (fresh) => fresh ?? room);
      });
    });
  }
}
