import type { NewSystemLine } from '@vp/core/repositories';
import type {
  PersonalControlRecord,
  WatchPartyBan,
  WatchPartyInvite,
  WatchPartyInviteLink,
  WatchPartyMember,
  WatchPartyMemberRole,
  WatchPartyMessage,
  WatchPartyQueueItem,
  WatchPartyRoleRecord,
  WatchPartyRoom,
} from '@vp/domain';

/** The composite keys the tables' primary keys are, joined. */
export const seatKey = (roomId: string, memberKey: string) => `${roomId}|${memberKey}`;
export const assignmentKey = (roomId: string, memberKey: string, roleId: string) =>
  `${roomId}|${memberKey}|${roleId}`;
export const controlKey = (userId: string, targetKey: string, roomId: string | null) =>
  `${userId}|${targetKey}|${roomId ?? ''}`;

/**
 * Every watch party table in one place, shared by the in-memory repositories, so a write that
 * spans tables in Postgres (a role change and its system line, an advance and the played item)
 * spans them here too.
 */
export class InMemoryWatchPartyStore {
  readonly rooms = new Map<string, WatchPartyRoom>();
  readonly members = new Map<string, WatchPartyMember>();
  readonly roles = new Map<string, WatchPartyRoleRecord>();
  readonly memberRoles = new Map<string, WatchPartyMemberRole>();
  readonly bans = new Map<string, WatchPartyBan>();
  readonly queue = new Map<string, WatchPartyQueueItem>();
  readonly messages = new Map<string, WatchPartyMessage>();
  readonly invites = new Map<string, WatchPartyInvite>();
  readonly inviteLinks = new Map<string, WatchPartyInviteLink>();
  readonly controls = new Map<string, PersonalControlRecord>();

  appendSystemLine(
    roomId: string,
    { id, line, videoId, positionMs, createdAt }: NewSystemLine
  ): void {
    this.messages.set(id, {
      id,
      roomId,
      authorKey: null,
      source: 'app',
      kind: 'system',
      body: '',
      system: line,
      videoId,
      positionMs,
      pinned: false,
      removedAt: null,
      createdAt,
    });
  }

  /** `null` when the room is gone. */
  bumpRolesVersion(roomId: string, at: Date): number | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const rolesVersion = room.rolesVersion + 1;
    this.rooms.set(roomId, { ...room, rolesVersion, updatedAt: at });
    return rolesVersion;
  }

  bumpQueueVersion(roomId: string): number | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const queueLength = [...this.queue.values()].filter(
      (item) => item.roomId === roomId && item.removedAt === null
    ).length;
    const queueVersion = room.queueVersion + 1;
    this.rooms.set(roomId, { ...room, queueVersion, queueLength });
    return queueVersion;
  }

  clear(): void {
    for (const table of [
      this.rooms,
      this.members,
      this.roles,
      this.memberRoles,
      this.bans,
      this.queue,
      this.messages,
      this.invites,
      this.inviteLinks,
      this.controls,
    ]) {
      table.clear();
    }
  }
}
