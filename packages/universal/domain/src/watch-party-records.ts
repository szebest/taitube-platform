import type {
  WatchPartyInviteStatus,
  WatchPartyJoinPath,
  WatchPartyMessageSource,
  WatchPartySystemEvent,
} from './watch-party';
import type { PersonalControl } from './watch-party-personal-controls';
import type { MemberKind } from './watch-party-principal';
import type { RoomRole } from './watch-party-roles';

/** A seat: who holds it and how they came by it. An account's name and avatar are read live. */
export interface WatchPartyMember {
  readonly roomId: string;
  readonly memberKey: string;
  readonly kind: MemberKind;
  readonly userId: string | null;
  readonly discordUserId: string | null;
  /** Snapshots for Discord members and guests. */
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly joinedVia: WatchPartyJoinPath;
  readonly joinedAt: Date;
  readonly leftAt: Date | null;
}

export interface WatchPartyBan {
  readonly roomId: string;
  readonly memberKey: string;
  /** A guest's, so the same person is refused with a new credential. */
  readonly ipHash: string | null;
  readonly bannedBy: string;
  readonly reason: string | null;
  readonly createdAt: Date;
}

export interface WatchPartyRoleRecord extends RoomRole {
  readonly roomId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WatchPartyMemberRole {
  readonly roomId: string;
  readonly memberKey: string;
  readonly roleId: string;
  readonly grantedBy: string;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

/** "Ana, Tom and 3 others are watching", frozen when the invite is sent. */
export interface WatchingSnapshot {
  readonly names: readonly string[];
  readonly count: number;
}

export interface WatchPartyInvite {
  readonly id: string;
  readonly roomId: string;
  readonly inviterId: string;
  readonly inviteeId: string;
  readonly status: WatchPartyInviteStatus;
  readonly watching: WatchingSnapshot;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface WatchPartyInviteLink {
  readonly id: string;
  readonly roomId: string;
  /** A member key: a Discord member may create one too. */
  readonly createdBy: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly maxUses: number | null;
  readonly uses: number;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export interface WatchPartyQueueItem {
  readonly id: string;
  readonly roomId: string;
  readonly videoId: string;
  readonly addedBy: string;
  readonly position: number;
  readonly startMs: number;
  readonly playedAt: Date | null;
  readonly removedAt: Date | null;
  readonly createdAt: Date;
}

export interface WatchPartySystemLine {
  readonly event: WatchPartySystemEvent;
  readonly actorKey: string | null;
  readonly targetKey: string | null;
  readonly detail: string | null;
}

/** `videoId` and `positionMs` are where the room was, so a later replay can place the line. */
export interface WatchPartyMessage {
  readonly id: string;
  readonly roomId: string;
  readonly authorKey: string | null;
  readonly source: WatchPartyMessageSource;
  readonly kind: 'text' | 'system';
  readonly body: string;
  readonly system: WatchPartySystemLine | null;
  readonly videoId: string | null;
  readonly positionMs: number | null;
  readonly pinned: boolean;
  readonly removedAt: Date | null;
  readonly createdAt: Date;
}

export interface PersonalControlRecord extends PersonalControl {
  readonly userId: string;
  readonly updatedAt: Date;
}
