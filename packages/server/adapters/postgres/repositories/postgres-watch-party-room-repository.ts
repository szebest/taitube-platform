import type {
  OwnerTransfer,
  PlaybackChange,
  RoomWrite,
  SettingsPatch,
  NewSystemLine,
  WatchPartyRoomRepositoryPort,
  WatchPartyRoomSeed,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { renumberPositions, type WatchPartyCloseReason, type WatchPartyRoom } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { andThen, err, fromPromise, map, ok, type Result } from '@vp/result';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';
import { replacePermissions, type RolePermissions } from './watch-party-role-permissions';
import { insertSystemLine } from './watch-party-writes';

const {
  watchPartyRooms: rooms,
  watchPartyRoles: roles,
  watchPartyMembers: members,
  watchPartyMemberRoles: memberRoles,
  watchPartyQueueItems: queue,
} = schema;

function toRoom(row: typeof rooms.$inferSelect): WatchPartyRoom {
  const { trendScore: _trendScore, searchText: _searchText, ...room } = row;
  return room;
}

export class PostgresWatchPartyRoomRepository implements WatchPartyRoomRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(seed: WatchPartyRoomSeed): Promise<Result<WatchPartyRoom, DatabaseUnavailable>> {
    const { room, roles: seedRoles, owner, queue: seedQueue } = seed;
    const created = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(rooms)
            .values({
              ...room,
              phase: room.playback.phase,
              queueLength: seedQueue.length,
              currentVideoId: seedQueue[0]?.videoId ?? null,
              updatedAt: room.createdAt,
            })
            .returning();
          await tx.insert(roles).values(
            seedRoles.map(({ id, key, kind, name, colour, position }) => ({
              id,
              roomId: room.id,
              key,
              kind,
              name,
              colour,
              position,
              createdAt: room.createdAt,
              updatedAt: room.createdAt,
            }))
          );
          await replacePermissions(tx, seedRoles);
          await tx.insert(members).values({ ...owner, leftAt: null });
          if (seedQueue.length > 0) {
            const positionOf = new Map(
              renumberPositions(seedQueue.map(({ id }) => id)).map((slot) => [
                slot.id,
                slot.position,
              ])
            );
            await tx
              .insert(queue)
              .values(
                seedQueue.map((item) => ({ ...item, position: positionOf.get(item.id) ?? 0 }))
              );
          }
          return row;
        }),
      databaseUnavailable.during('createWatchPartyRoom')
    );
    return andThen(created, (row) =>
      row ? ok(toRoom(row)) : err(databaseUnavailable('createWatchPartyRoom'))
    );
  }

  async findById(id: string): Promise<Result<WatchPartyRoom | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(rooms).where(eq(rooms.id, id)),
      databaseUnavailable.during('findWatchPartyRoom')
    );
    return map(rows, ([row]) => (row ? toRoom(row) : null));
  }

  async countOpenOwnedBy(ownerKey: string): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(rooms)
          .where(and(eq(rooms.ownerKey, ownerKey), eq(rooms.status, 'open'))),
      databaseUnavailable.during('countOpenWatchPartyRooms')
    );
    return map(rows, ([row]) => row?.count ?? 0);
  }

  async listOpenOwnedBy(ownerKey: string): Promise<Result<WatchPartyRoom[], DatabaseUnavailable>> {
    const found = await fromPromise(
      () =>
        this.db
          .select()
          .from(rooms)
          .where(and(eq(rooms.ownerKey, ownerKey), eq(rooms.status, 'open')))
          .orderBy(desc(rooms.createdAt), desc(rooms.id)),
      databaseUnavailable.during('listOpenWatchPartyRooms')
    );
    return map(found, (rows) => rows.map(toRoom));
  }

  async updateSettings(
    id: string,
    patch: SettingsPatch,
    expectedVersion: number,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    return this.write('updateWatchPartySettings', id, line, (tx) =>
      tx
        .update(rooms)
        .set({
          ...patch,
          version: sql`${rooms.version} + 1`,
          updatedAt: at,
        })
        .where(and(eq(rooms.id, id), eq(rooms.version, expectedVersion)))
        .returning()
    );
  }

  async commitPlayback(
    id: string,
    change: PlaybackChange
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    const { expected, playback, playedItemId, currentVideoId, line, at } = change;
    return this.write('commitWatchPartyPlayback', id, line, async (tx) => {
      const updated = await tx
        .update(rooms)
        .set({
          playback,
          phase: playback.phase,
          playbackVersion: sql`${rooms.playbackVersion} + 1`,
          startedAt:
            playback.phase === 'playing'
              ? sql`coalesce(${rooms.startedAt}, ${sql.param(at, rooms.startedAt)})`
              : undefined,
          currentVideoId,
          updatedAt: at,
        })
        .where(
          and(
            eq(rooms.id, id),
            eq(rooms.playbackVersion, expected.playbackVersion),
            eq(rooms.rolesVersion, expected.rolesVersion),
            eq(rooms.status, 'open')
          )
        )
        .returning();
      if (updated.length > 0 && playedItemId !== undefined) {
        await tx
          .update(queue)
          .set({ playedAt: at })
          .where(and(eq(queue.id, playedItemId), eq(queue.roomId, id)));
      }
      return updated;
    });
  }

  async close(
    id: string,
    reason: WatchPartyCloseReason,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    return this.write('closeWatchPartyRoom', id, line, (tx) =>
      tx
        .update(rooms)
        .set({ status: 'closed', closedReason: reason, closedAt: at, updatedAt: at })
        .where(and(eq(rooms.id, id), eq(rooms.status, 'open')))
        .returning()
    );
  }

  async recordPresence(
    id: string,
    present: number,
    at: Date
  ): Promise<Result<void, DatabaseUnavailable>> {
    const recorded = await fromPromise(
      () =>
        this.db
          .update(rooms)
          .set({ presentCount: present, lastPresentAt: present > 0 ? at : undefined })
          .where(eq(rooms.id, id)),
      databaseUnavailable.during('recordWatchPartyPresence')
    );
    return map(recorded, () => undefined);
  }

  async transferOwner(
    id: string,
    transfer: OwnerTransfer
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    const { fromKey, toKey, expectedRolesVersion, cohostRoleId, line, at } = transfer;
    return this.write('transferWatchPartyOwner', id, line, async (tx) => {
      const updated = await tx
        .update(rooms)
        .set({
          ownerKey: toKey,
          rolesVersion: sql`${rooms.rolesVersion} + 1`,
          updatedAt: at,
        })
        .where(
          and(
            eq(rooms.id, id),
            eq(rooms.ownerKey, fromKey),
            eq(rooms.rolesVersion, expectedRolesVersion),
            eq(rooms.status, 'open')
          )
        )
        .returning();
      if (updated.length === 0) return updated;
      await tx
        .insert(memberRoles)
        .values({
          roomId: id,
          memberKey: fromKey,
          roleId: cohostRoleId,
          grantedBy: toKey,
          expiresAt: null,
          createdAt: at,
        })
        .onConflictDoUpdate({
          target: [memberRoles.roomId, memberRoles.memberKey, memberRoles.roleId],
          set: { grantedBy: toKey, expiresAt: null },
        });
      await tx
        .delete(memberRoles)
        .where(and(eq(memberRoles.roomId, id), eq(memberRoles.memberKey, toKey)));
      return updated;
    });
  }

  async upgradeRoles(
    id: string,
    upgraded: readonly RolePermissions[],
    fromVersion: number,
    toVersion: number
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const claimed = await tx
            .update(rooms)
            .set({ permissionsVersion: toVersion })
            .where(and(eq(rooms.id, id), eq(rooms.permissionsVersion, fromVersion)))
            .returning({ id: rooms.id });
          if (claimed.length === 0) return false;
          await replacePermissions(tx, upgraded);
          return true;
        }),
      databaseUnavailable.during('upgradeWatchPartyRoles')
    );
  }

  /**
   * One compare-and-set in a transaction: `update` returns the changed row or nothing. The system
   * line is written only when it applied; nothing changed means the room is stale or gone.
   */
  private async write(
    operation: string,
    id: string,
    line: NewSystemLine | null,
    update: (tx: PostgresDatabase) => Promise<(typeof rooms.$inferSelect)[]>
  ): Promise<Result<RoomWrite, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<RoomWrite> => {
          const [applied] = await update(tx);
          if (applied) {
            if (line) await insertSystemLine(tx, id, line);
            return { type: 'applied', room: toRoom(applied) };
          }
          const [current] = await tx.select().from(rooms).where(eq(rooms.id, id));
          return current ? { type: 'stale', room: toRoom(current) } : { type: 'missing' };
        }),
      databaseUnavailable.during(operation)
    );
  }
}
