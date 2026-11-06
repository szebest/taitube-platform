import type {
  NewSystemLine,
  NewWatchPartyMember,
  SeatMove,
  WatchPartyMemberRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { WatchPartyBan, WatchPartyMember } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { andThen, err, fromPromise, map, ok, type Result } from '@vp/result';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import type { PostgresDatabase } from './types';
import { insertSystemLine } from './watch-party-writes';

const {
  watchPartyMembers: members,
  watchPartyMemberRoles: memberRoles,
  watchPartyBans: bans,
  watchPartyRooms: rooms,
} = schema;

export class PostgresWatchPartyMemberRepository implements WatchPartyMemberRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async find(
    roomId: string,
    memberKey: string
  ): Promise<Result<WatchPartyMember | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(members)
          .where(and(eq(members.roomId, roomId), eq(members.memberKey, memberKey))),
      databaseUnavailable.during('findWatchPartyMember')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async listSeated(roomId: string): Promise<Result<WatchPartyMember[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(members)
          .where(and(eq(members.roomId, roomId), isNull(members.leftAt)))
          .orderBy(asc(members.joinedAt), asc(members.memberKey)),
      databaseUnavailable.during('listSeatedWatchPartyMembers')
    );
  }

  async join(
    member: NewWatchPartyMember,
    line: NewSystemLine | null
  ): Promise<Result<WatchPartyMember, DatabaseUnavailable>> {
    const joined = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(members)
            .values({ ...member, leftAt: null })
            .onConflictDoUpdate({
              target: [members.roomId, members.memberKey],
              set: { displayName: member.displayName, avatarUrl: member.avatarUrl, leftAt: null },
            })
            .returning();
          if (line) await insertSystemLine(tx, member.roomId, line);
          return row;
        }),
      databaseUnavailable.during('joinWatchPartyRoom')
    );
    return andThen(joined, (row) =>
      row ? ok(row) : err(databaseUnavailable('joinWatchPartyRoom'))
    );
  }

  async leave(
    roomId: string,
    memberKey: string,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const left = await tx
            .update(members)
            .set({ leftAt: at })
            .where(
              and(
                eq(members.roomId, roomId),
                eq(members.memberKey, memberKey),
                isNull(members.leftAt)
              )
            )
            .returning({ memberKey: members.memberKey });
          if (left.length === 0) return false;
          if (line) await insertSystemLine(tx, roomId, line);
          return true;
        }),
      databaseUnavailable.during('leaveWatchPartyRoom')
    );
  }

  async removeGuests(
    roomId: string,
    line: NewSystemLine,
    at: Date
  ): Promise<Result<string[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const left = await tx
            .update(members)
            .set({ leftAt: at })
            .where(
              and(eq(members.roomId, roomId), eq(members.kind, 'guest'), isNull(members.leftAt))
            )
            .returning({ memberKey: members.memberKey });
          if (left.length > 0) await insertSystemLine(tx, roomId, line);
          return left.map(({ memberKey }) => memberKey).sort();
        }),
      databaseUnavailable.during('removeWatchPartyGuests')
    );
  }

  async ban(ban: WatchPartyBan, line: NewSystemLine): Promise<Result<void, DatabaseUnavailable>> {
    const banned = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await tx
            .insert(bans)
            .values(ban)
            .onConflictDoUpdate({
              target: [bans.roomId, bans.memberKey],
              set: {
                ipHash: ban.ipHash,
                bannedBy: ban.bannedBy,
                reason: ban.reason,
                createdAt: ban.createdAt,
              },
            });
          await tx
            .update(members)
            .set({ leftAt: ban.createdAt })
            .where(
              and(
                eq(members.roomId, ban.roomId),
                eq(members.memberKey, ban.memberKey),
                isNull(members.leftAt)
              )
            );
          await tx
            .delete(memberRoles)
            .where(
              and(eq(memberRoles.roomId, ban.roomId), eq(memberRoles.memberKey, ban.memberKey))
            );
          await insertSystemLine(tx, ban.roomId, line);
        }),
      databaseUnavailable.during('banWatchPartyMember')
    );
    return map(banned, () => undefined);
  }

  async unban(roomId: string, memberKey: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const removed = await fromPromise(
      () =>
        this.db
          .delete(bans)
          .where(and(eq(bans.roomId, roomId), eq(bans.memberKey, memberKey)))
          .returning({ memberKey: bans.memberKey }),
      databaseUnavailable.during('unbanWatchPartyMember')
    );
    return map(removed, (rows) => rows.length > 0);
  }

  async isBanned(
    roomId: string,
    memberKey: string,
    ipHash: string | null
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const matches = await fromPromise(
      () =>
        this.db
          .select({ memberKey: bans.memberKey })
          .from(bans)
          .where(
            and(
              eq(bans.roomId, roomId),
              or(
                eq(bans.memberKey, memberKey),
                ipHash === null ? undefined : eq(bans.ipHash, ipHash)
              )
            )
          )
          .limit(1),
      databaseUnavailable.during('isWatchPartyMemberBanned')
    );
    return map(matches, (rows) => rows.length > 0);
  }

  async moveSeat(move: SeatMove): Promise<Result<WatchPartyMember | null, DatabaseUnavailable>> {
    const { roomId, fromKey, to } = move;
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [old] = await tx
            .select()
            .from(members)
            .where(
              and(
                eq(members.roomId, roomId),
                eq(members.memberKey, fromKey),
                isNull(members.leftAt)
              )
            )
            .for('update');
          if (!old) return null;

          const seat = {
            ...to,
            roomId,
            joinedVia: old.joinedVia,
            joinedAt: old.joinedAt,
            leftAt: null,
          };
          const [moved] = await tx
            .insert(members)
            .values(seat)
            .onConflictDoUpdate({ target: [members.roomId, members.memberKey], set: seat })
            .returning();

          const held = await tx
            .select()
            .from(memberRoles)
            .where(and(eq(memberRoles.roomId, roomId), eq(memberRoles.memberKey, fromKey)));
          if (held.length > 0) {
            await tx
              .insert(memberRoles)
              .values(held.map((row) => ({ ...row, memberKey: to.memberKey })))
              .onConflictDoNothing();
            await tx
              .delete(memberRoles)
              .where(and(eq(memberRoles.roomId, roomId), eq(memberRoles.memberKey, fromKey)));
          }

          const [ban] = await tx
            .select()
            .from(bans)
            .where(and(eq(bans.roomId, roomId), eq(bans.memberKey, fromKey)));
          if (ban) {
            await tx
              .insert(bans)
              .values({ ...ban, memberKey: to.memberKey })
              .onConflictDoNothing();
          }

          await tx
            .delete(members)
            .where(and(eq(members.roomId, roomId), eq(members.memberKey, fromKey)));
          return moved ?? null;
        }),
      databaseUnavailable.during('moveWatchPartySeat')
    );
  }

  async openRoomIdsOf(userId: string): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ roomId: members.roomId })
          .from(members)
          .innerJoin(rooms, eq(rooms.id, members.roomId))
          .where(and(eq(members.userId, userId), isNull(members.leftAt), eq(rooms.status, 'open')))
          .orderBy(asc(members.roomId)),
      databaseUnavailable.during('listOpenWatchPartyRoomsOf')
    );
    return map(rows, (found) => found.map(({ roomId }) => roomId));
  }
}
