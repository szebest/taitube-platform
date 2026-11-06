import type {
  NewSystemLine,
  NewWatchPartyMember,
  SeatMove,
  WatchPartyMemberRepositoryPort,
} from '@vp/core/repositories';
import type { WatchPartyBan, WatchPartyMember } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import {
  assignmentKey,
  type InMemoryWatchPartyStore,
  seatKey,
} from './in-memory-watch-party-store';

export class InMemoryWatchPartyMemberRepository implements WatchPartyMemberRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async find(
    roomId: string,
    memberKey: string
  ): Promise<Result<WatchPartyMember | null, DatabaseUnavailable>> {
    const seat = this.store.members.get(seatKey(roomId, memberKey));
    return ok(seat ? { ...seat } : null);
  }

  async listSeated(roomId: string): Promise<Result<WatchPartyMember[], DatabaseUnavailable>> {
    const seated = [...this.store.members.values()]
      .filter((seat) => seat.roomId === roomId && seat.leftAt === null)
      .sort(
        (a, b) =>
          a.joinedAt.getTime() - b.joinedAt.getTime() || (a.memberKey < b.memberKey ? -1 : 1)
      );
    return ok(seated.map((seat) => ({ ...seat })));
  }

  async join(
    member: NewWatchPartyMember,
    line: NewSystemLine | null
  ): Promise<Result<WatchPartyMember, DatabaseUnavailable>> {
    const key = seatKey(member.roomId, member.memberKey);
    const existing = this.store.members.get(key);
    const seat: WatchPartyMember = existing
      ? { ...existing, displayName: member.displayName, avatarUrl: member.avatarUrl, leftAt: null }
      : { ...member, leftAt: null };
    this.store.members.set(key, seat);
    if (line) this.store.appendSystemLine(member.roomId, line);
    return ok({ ...seat });
  }

  async leave(
    roomId: string,
    memberKey: string,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const key = seatKey(roomId, memberKey);
    const seat = this.store.members.get(key);
    if (!seat || seat.leftAt !== null) return ok(false);
    this.store.members.set(key, { ...seat, leftAt: at });
    if (line) this.store.appendSystemLine(roomId, line);
    return ok(true);
  }

  async removeGuests(
    roomId: string,
    line: NewSystemLine,
    at: Date
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const guests = [...this.store.members.values()].filter(
      (seat) => seat.roomId === roomId && seat.kind === 'guest' && seat.leftAt === null
    );
    for (const seat of guests) {
      this.store.members.set(seatKey(roomId, seat.memberKey), { ...seat, leftAt: at });
    }
    if (guests.length > 0) this.store.appendSystemLine(roomId, line);
    return ok(guests.map(({ memberKey }) => memberKey).sort());
  }

  async ban(ban: WatchPartyBan, line: NewSystemLine): Promise<Result<void, DatabaseUnavailable>> {
    const { roomId, memberKey } = ban;
    this.store.bans.set(seatKey(roomId, memberKey), { ...ban });
    const seat = this.store.members.get(seatKey(roomId, memberKey));
    if (seat?.leftAt === null) {
      this.store.members.set(seatKey(roomId, memberKey), { ...seat, leftAt: ban.createdAt });
    }
    this.dropRoles(roomId, memberKey);
    this.store.appendSystemLine(roomId, line);
    return ok();
  }

  async unban(roomId: string, memberKey: string): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.store.bans.delete(seatKey(roomId, memberKey)));
  }

  async isBanned(
    roomId: string,
    memberKey: string,
    ipHash: string | null
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const banned = [...this.store.bans.values()].some(
      (ban) =>
        ban.roomId === roomId &&
        (ban.memberKey === memberKey || (ipHash !== null && ban.ipHash === ipHash))
    );
    return ok(banned);
  }

  async moveSeat(move: SeatMove): Promise<Result<WatchPartyMember | null, DatabaseUnavailable>> {
    const { roomId, fromKey, to } = move;
    const old = this.store.members.get(seatKey(roomId, fromKey));
    if (!old || old.leftAt !== null) return ok(null);

    const moved: WatchPartyMember = {
      ...to,
      roomId,
      joinedVia: old.joinedVia,
      joinedAt: old.joinedAt,
      leftAt: null,
    };
    this.store.members.set(seatKey(roomId, to.memberKey), moved);

    for (const [key, row] of [...this.store.memberRoles]) {
      if (row.roomId !== roomId || row.memberKey !== fromKey) continue;
      const target = assignmentKey(roomId, to.memberKey, row.roleId);
      if (!this.store.memberRoles.has(target)) {
        this.store.memberRoles.set(target, { ...row, memberKey: to.memberKey });
      }
      this.store.memberRoles.delete(key);
    }

    const ban = this.store.bans.get(seatKey(roomId, fromKey));
    const banKey = seatKey(roomId, to.memberKey);
    if (ban && !this.store.bans.has(banKey)) {
      this.store.bans.set(banKey, { ...ban, memberKey: to.memberKey });
    }

    this.store.members.delete(seatKey(roomId, fromKey));
    return ok({ ...moved });
  }

  async openRoomIdsOf(userId: string): Promise<Result<string[], DatabaseUnavailable>> {
    const roomIds = [...this.store.members.values()]
      .filter(
        (seat) =>
          seat.userId === userId &&
          seat.leftAt === null &&
          this.store.rooms.get(seat.roomId)?.status === 'open'
      )
      .map((seat) => seat.roomId);
    return ok(roomIds.sort());
  }

  clear(): void {
    this.store.clear();
  }

  private dropRoles(roomId: string, memberKey: string): void {
    for (const [key, row] of this.store.memberRoles) {
      if (row.roomId === roomId && row.memberKey === memberKey) this.store.memberRoles.delete(key);
    }
  }
}
