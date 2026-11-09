import type { WatchPartyView } from '@vp/api-contracts';
import type { VideoRecord } from '@vp/core/repositories';
import {
  effectiveCapacity,
  type EffectivePermissions,
  type MemberKind,
  type RosterEntry,
  type WatchPartyJoinPath,
  type WatchPartyMember,
  type WatchPartyMemberRole,
  type WatchPartyPermission,
  type WatchPartyRoom,
} from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import { thumbnailUrl } from '../video-views';
import type { PartyPerson } from './watch-party-names';

export type PartyVideoView = NonNullable<WatchPartyView['currentVideo']>;

export function toPartyVideoView(
  video: Pick<VideoRecord, 'id' | 'title' | 'durationMs' | 'customThumbnailKey' | 'posterKey'>,
  cdn: CdnBase
): PartyVideoView {
  return {
    id: video.id,
    title: video.title,
    durationMs: video.durationMs,
    thumbnailUrl: thumbnailUrl(video, cdn) ?? null,
  };
}

export interface RoomViewInput {
  readonly room: WatchPartyRoom;
  readonly owner: PartyPerson;
  readonly currentVideo: PartyVideoView | null;
  readonly ceiling: number;
}

export function toWatchPartyView({
  room,
  owner,
  currentVideo,
  ceiling,
}: RoomViewInput): WatchPartyView {
  return {
    id: room.id,
    name: room.name,
    owner,
    asChannelId: room.asChannelId,
    visibility: room.visibility,
    hasPassword: room.passwordHash !== null,
    capacity: room.capacity,
    effectiveCapacity: effectiveCapacity(room.capacity, ceiling),
    allowGuests: room.allowGuests,
    chatEnabled: room.chatEnabled,
    slowModeSeconds: room.slowModeSeconds,
    bufferPolicy: room.bufferPolicy,
    autoplay: room.autoplay,
    skipVotePercent: room.skipVotePercent,
    idleClose: room.idleClose,
    language: room.language,
    accent: room.accent,
    scheduledFor: room.scheduledFor?.toISOString() ?? null,
    autoStart: room.autoStart,
    phase: room.phase,
    currentVideo,
    queueLength: room.queueLength,
    presentCount: room.presentCount,
    status: room.status,
    closedReason: room.closedReason,
    version: room.version,
    createdAt: room.createdAt.toISOString(),
    startedAt: room.startedAt?.toISOString() ?? null,
  };
}

/** The roles a member holds now: an expired row is still stored until the sweep, and holds nothing. */
export function heldRoleIds(
  assignments: readonly WatchPartyMemberRole[],
  memberKey: string,
  now: Date
): string[] {
  return assignments
    .filter((row) => row.memberKey === memberKey && (row.expiresAt === null || row.expiresAt > now))
    .map(({ roleId }) => roleId);
}

export interface MembershipView {
  readonly roomId: string;
  readonly memberKey: string;
  readonly kind: MemberKind;
  readonly name: string;
  readonly joinedVia: WatchPartyJoinPath;
  readonly roleIds: string[];
  readonly permissions: WatchPartyPermission[];
}

export function toMembershipView(
  seat: WatchPartyMember,
  name: string,
  roleIds: readonly string[],
  effective: EffectivePermissions
): MembershipView {
  return {
    roomId: seat.roomId,
    memberKey: seat.memberKey,
    kind: seat.kind,
    name,
    joinedVia: seat.joinedVia,
    roleIds: [...roleIds],
    permissions: [...effective.permissions],
  };
}

export function toRosterEntry(
  seat: WatchPartyMember,
  person: PartyPerson,
  roleIds: readonly string[],
  room: Pick<WatchPartyRoom, 'phase'>
): RosterEntry {
  return {
    memberKey: seat.memberKey,
    kind: seat.kind,
    source: 'app',
    name: person.name,
    avatarUrl: person.avatarUrl,
    roleIds: [...roleIds],
    ready: false,
    sync: room.phase === 'lobby' ? 'lobby' : 'in_sync',
    voice: 'off',
    away: false,
  };
}
