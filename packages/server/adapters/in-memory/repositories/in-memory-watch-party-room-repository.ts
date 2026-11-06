import type {
  NewSystemLine,
  OwnerTransfer,
  PlaybackChange,
  RoomWrite,
  SettingsPatch,
  WatchPartyRoomRepositoryPort,
  WatchPartyRoomSeed,
} from '@vp/core/repositories';
import {
  renumberPositions,
  WATCH_PARTY_PERMISSION_IDS,
  type WatchPartyCloseReason,
  type WatchPartyRoom,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import {
  assignmentKey,
  type InMemoryWatchPartyStore,
  seatKey,
} from './in-memory-watch-party-store';

const copyOf = (room: WatchPartyRoom): WatchPartyRoom => ({
  ...room,
  playback: { ...room.playback },
});

function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

export class InMemoryWatchPartyRoomRepository implements WatchPartyRoomRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async create(seed: WatchPartyRoomSeed): Promise<Result<WatchPartyRoom, DatabaseUnavailable>> {
    const { room, roles, owner, queue } = seed;
    const created: WatchPartyRoom = {
      ...room,
      phase: room.playback.phase,
      playbackVersion: 0,
      rolesVersion: 0,
      queueLength: queue.length,
      queueVersion: 0,
      currentVideoId: queue[0]?.videoId ?? null,
      presentCount: 0,
      status: 'open',
      closedReason: null,
      hiddenAt: null,
      version: 1,
      updatedAt: room.createdAt,
      startedAt: null,
      lastPresentAt: null,
      closedAt: null,
    };
    this.store.rooms.set(room.id, copyOf(created));
    for (const role of roles) {
      this.store.roles.set(role.id, {
        ...role,
        roomId: room.id,
        permissions: [...role.permissions],
        createdAt: room.createdAt,
        updatedAt: room.createdAt,
      });
    }
    this.store.members.set(seatKey(room.id, owner.memberKey), { ...owner, leftAt: null });
    const positionOf = new Map(
      renumberPositions(queue.map(({ id }) => id)).map((slot) => [slot.id, slot.position])
    );
    for (const item of queue) {
      this.store.queue.set(item.id, {
        ...item,
        position: positionOf.get(item.id) ?? 0,
        playedAt: null,
        removedAt: null,
      });
    }
    return ok(copyOf(created));
  }

  async findById(id: string): Promise<Result<WatchPartyRoom | null, DatabaseUnavailable>> {
    const room = this.store.rooms.get(id);
    return ok(room ? copyOf(room) : null);
  }

  async countOpenOwnedBy(ownerKey: string): Promise<Result<number, DatabaseUnavailable>> {
    const open = [...this.store.rooms.values()].filter(
      (room) => room.ownerKey === ownerKey && room.status === 'open'
    );
    return ok(open.length);
  }

  async updateSettings(
    id: string,
    patch: SettingsPatch,
    expectedVersion: number,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    return ok(
      this.apply(
        id,
        (room) => room.version === expectedVersion,
        (room) => ({
          ...room,
          ...definedOnly(patch),
          version: room.version + 1,
          updatedAt: at,
        }),
        line
      )
    );
  }

  async commitPlayback(
    id: string,
    change: PlaybackChange
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    const { expected, playback, playedItemId, currentVideoId, line, at } = change;
    const write = this.apply(
      id,
      (room) =>
        room.playbackVersion === expected.playbackVersion &&
        room.rolesVersion === expected.rolesVersion &&
        room.status === 'open',
      (room) => ({
        ...room,
        playback: { ...playback },
        phase: playback.phase,
        playbackVersion: room.playbackVersion + 1,
        startedAt: playback.phase === 'playing' ? (room.startedAt ?? at) : room.startedAt,
        currentVideoId: currentVideoId === undefined ? room.currentVideoId : currentVideoId,
        updatedAt: at,
      }),
      line
    );
    const item = playedItemId === undefined ? undefined : this.store.queue.get(playedItemId);
    if (write.type === 'applied' && item?.roomId === id) {
      this.store.queue.set(item.id, { ...item, playedAt: at });
    }
    return ok(write);
  }

  async close(
    id: string,
    reason: WatchPartyCloseReason,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    return ok(
      this.apply(
        id,
        (room) => room.status === 'open',
        (room) => ({
          ...room,
          status: 'closed',
          closedReason: reason,
          closedAt: at,
          updatedAt: at,
        }),
        line
      )
    );
  }

  async recordPresence(
    id: string,
    present: number,
    at: Date
  ): Promise<Result<void, DatabaseUnavailable>> {
    const room = this.store.rooms.get(id);
    if (room) {
      this.store.rooms.set(id, {
        ...room,
        presentCount: present,
        lastPresentAt: present > 0 ? at : room.lastPresentAt,
      });
    }
    return ok();
  }

  async transferOwner(
    id: string,
    transfer: OwnerTransfer
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    const { fromKey, toKey, expectedRolesVersion, cohostRoleId, line, at } = transfer;
    const write = this.apply(
      id,
      (room) =>
        room.ownerKey === fromKey &&
        room.rolesVersion === expectedRolesVersion &&
        room.status === 'open',
      (room) => ({ ...room, ownerKey: toKey, rolesVersion: room.rolesVersion + 1, updatedAt: at }),
      line
    );
    if (write.type !== 'applied') return ok(write);
    this.store.memberRoles.set(assignmentKey(id, fromKey, cohostRoleId), {
      roomId: id,
      memberKey: fromKey,
      roleId: cohostRoleId,
      grantedBy: toKey,
      expiresAt: null,
      createdAt:
        this.store.memberRoles.get(assignmentKey(id, fromKey, cohostRoleId))?.createdAt ?? at,
    });
    for (const [key, assignment] of this.store.memberRoles) {
      if (assignment.roomId === id && assignment.memberKey === toKey) {
        this.store.memberRoles.delete(key);
      }
    }
    return ok(write);
  }

  async upgradeRoles(
    id: string,
    upgraded: readonly { readonly id: string; readonly permissions: readonly string[] }[],
    fromVersion: number,
    toVersion: number
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const room = this.store.rooms.get(id);
    if (room?.permissionsVersion !== fromVersion) return ok(false);
    this.store.rooms.set(id, { ...room, permissionsVersion: toVersion });
    for (const { id: roleId, permissions } of upgraded) {
      const role = this.store.roles.get(roleId);
      if (role) {
        this.store.roles.set(roleId, {
          ...role,
          permissions: WATCH_PARTY_PERMISSION_IDS.filter((id) => permissions.includes(id)),
        });
      }
    }
    return ok(true);
  }

  clear(): void {
    this.store.clear();
  }

  private apply(
    id: string,
    holds: (room: WatchPartyRoom) => boolean,
    change: (room: WatchPartyRoom) => WatchPartyRoom,
    line: NewSystemLine | null
  ): RoomWrite {
    const room = this.store.rooms.get(id);
    if (!room) return { type: 'missing' };
    if (!holds(room)) return { type: 'stale', room: copyOf(room) };
    const next = change(room);
    this.store.rooms.set(id, next);
    if (line) this.store.appendSystemLine(id, line);
    return { type: 'applied', room: copyOf(next) };
  }
}
