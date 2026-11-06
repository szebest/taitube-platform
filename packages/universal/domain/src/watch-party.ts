import { MS_PER_HOUR, MS_PER_MINUTE } from './time';
import type { WatchPartyPlayback } from './watch-party-clock';

export const WATCH_PARTY_VISIBILITIES = ['public', 'unlisted', 'private'] as const;
export type WatchPartyVisibility = (typeof WATCH_PARTY_VISIBILITIES)[number];

export const WATCH_PARTY_PHASES = ['lobby', 'playing', 'paused', 'finished'] as const;
export type WatchPartyPhase = (typeof WATCH_PARTY_PHASES)[number];

export const WATCH_PARTY_STATUSES = ['open', 'closed'] as const;
export type WatchPartyStatus = (typeof WATCH_PARTY_STATUSES)[number];

export const WATCH_PARTY_CLOSE_REASONS = ['owner', 'moderator', 'idle', 'not_started'] as const;
export type WatchPartyCloseReason = (typeof WATCH_PARTY_CLOSE_REASONS)[number];

export const WATCH_PARTY_BUFFER_POLICIES = ['wait', 'continue'] as const;
export type WatchPartyBufferPolicy = (typeof WATCH_PARTY_BUFFER_POLICIES)[number];

export const WATCH_PARTY_IDLE_CLOSE = ['15m', '1h', '24h', 'never'] as const;
export type WatchPartyIdleClose = (typeof WATCH_PARTY_IDLE_CLOSE)[number];

export const WATCH_PARTY_SLOW_MODE_SECONDS = [0, 5, 10, 30, 60] as const;
export type WatchPartySlowModeSeconds = (typeof WATCH_PARTY_SLOW_MODE_SECONDS)[number];

export const WATCH_PARTY_JOIN_PATHS = [
  'link',
  'password',
  'invite',
  'invite_link',
  'discovery',
  'owner',
  'activity',
  'bridge',
] as const;
export type WatchPartyJoinPath = (typeof WATCH_PARTY_JOIN_PATHS)[number];

export const WATCH_PARTY_MESSAGE_SOURCES = ['app', 'activity', 'discord'] as const;
export type WatchPartyMessageSource = (typeof WATCH_PARTY_MESSAGE_SOURCES)[number];

/** What a stored system line records; each viewer may hide them. */
export const WATCH_PARTY_SYSTEM_EVENTS = [
  'joined',
  'left',
  'now_playing',
  'owner_changed',
  'role_assigned',
  'role_revoked',
  'roles_changed',
  'settings_changed',
  'message_removed',
  'kicked',
  'banned',
  'video_unavailable',
] as const;
export type WatchPartySystemEvent = (typeof WATCH_PARTY_SYSTEM_EVENTS)[number];

/** Why the room clock changed, on every `state` frame. */
export const WATCH_PARTY_STATE_REASONS = [
  'command',
  'buffering',
  'advance',
  'skip',
  'system',
] as const;
export type WatchPartyStateReason = (typeof WATCH_PARTY_STATE_REASONS)[number];

/** The preview's answer to "can I join": a seat already, yes, or why not. */
export const WATCH_PARTY_JOIN_STATES = [
  'member',
  'yes',
  'password',
  'full',
  'banned',
  'guests_off',
  'closed',
] as const;
export type WatchPartyJoinState = (typeof WATCH_PARTY_JOIN_STATES)[number];

export const WATCH_PARTY_PREVIEW_ACTIONS = ['guest', 'discord', 'sign_in'] as const;
export type WatchPartyPreviewAction = (typeof WATCH_PARTY_PREVIEW_ACTIONS)[number];

export const WATCH_PARTY_REQUEST_KINDS = ['seek', 'skip', 'start'] as const;
export type WatchPartyRequestKind = (typeof WATCH_PARTY_REQUEST_KINDS)[number];

export const WATCH_PARTY_INVITE_STATUSES = ['pending', 'joined', 'declined', 'revoked'] as const;
export type WatchPartyInviteStatus = (typeof WATCH_PARTY_INVITE_STATUSES)[number];

export const WATCH_PARTY_INVITE_LINK_TTLS = ['1h', '24h', '7d'] as const;
export type WatchPartyInviteLinkTtl = (typeof WATCH_PARTY_INVITE_LINK_TTLS)[number];

/** The fixed reaction palette: a reaction names one of these, never free text. */
export const WATCH_PARTY_REACTIONS = ['😂', '😮', '😍', '👏', '🔥', '😢', '😱', '🎉'] as const;
export type WatchPartyReaction = (typeof WATCH_PARTY_REACTIONS)[number];

export const WATCH_PARTY_LIMITS = {
  queueItems: 200,
  pendingItemsPerMember: 3,
  pendingInvitesPerRoom: 50,
  invitesPerRequest: 20,
  chatBacklog: 200,
  skipVotePercent: { min: 1, max: 100, default: 50 },
  capacityMin: 2,
} as const;

/** How long a room with nobody present stays open; `null` keeps a persistent room until closed by hand. */
export const IDLE_CLOSE_MS: Readonly<Record<WatchPartyIdleClose, number | null>> = {
  '15m': 15 * MS_PER_MINUTE,
  '1h': MS_PER_HOUR,
  '24h': 24 * MS_PER_HOUR,
  never: null,
};

export const INVITE_LINK_TTL_MS: Readonly<Record<WatchPartyInviteLinkTtl, number>> = {
  '1h': MS_PER_HOUR,
  '24h': 24 * MS_PER_HOUR,
  '7d': 7 * 24 * MS_PER_HOUR,
};

/** Guests are welcome where the link is the access, and kept out of a room meant for invitees. */
export function defaultAllowGuests(visibility: WatchPartyVisibility): boolean {
  return visibility !== 'private';
}

export interface WatchPartySettings {
  readonly name: string;
  readonly visibility: WatchPartyVisibility;
  readonly capacity: number | null;
  readonly allowGuests: boolean;
  readonly chatEnabled: boolean;
  readonly slowModeSeconds: WatchPartySlowModeSeconds;
  readonly bufferPolicy: WatchPartyBufferPolicy;
  readonly autoplay: boolean;
  readonly skipVotePercent: number;
  readonly idleClose: WatchPartyIdleClose;
  readonly language: string | null;
  readonly accent: string | null;
  readonly scheduledFor: Date | null;
  readonly autoStart: boolean;
}

/** A quick party from "Watch together": unlisted, guests in, chat on, no limits, closed 15 minutes after the last person leaves. */
export const QUICK_PARTY_SETTINGS = {
  visibility: 'unlisted',
  capacity: null,
  allowGuests: true,
  chatEnabled: true,
  slowModeSeconds: 0,
  bufferPolicy: 'wait',
  autoplay: true,
  skipVotePercent: WATCH_PARTY_LIMITS.skipVotePercent.default,
  idleClose: '15m',
  language: null,
  accent: null,
  scheduledFor: null,
  autoStart: false,
} as const satisfies Omit<WatchPartySettings, 'name'>;

export interface WatchPartyRoom extends WatchPartySettings {
  readonly id: string;
  /** A member key, an account's or a Discord member's, never a guest's. */
  readonly ownerKey: string;
  readonly asChannelId: string | null;
  readonly passwordHash: string | null;
  readonly phase: WatchPartyPhase;
  readonly playback: WatchPartyPlayback;
  /** The fencing token of the room clock; `rolesVersion` sits in the same compare-and-set. */
  readonly playbackVersion: number;
  readonly rolesVersion: number;
  readonly permissionsVersion: number;
  readonly queueLength: number;
  /** Bumped by every queue edit, so a `queue` frame older than the one shown is dropped. */
  readonly queueVersion: number;
  readonly currentVideoId: string | null;
  readonly presentCount: number;
  readonly status: WatchPartyStatus;
  readonly closedReason: WatchPartyCloseReason | null;
  readonly hiddenAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startedAt: Date | null;
  readonly lastPresentAt: Date | null;
  readonly closedAt: Date | null;
}
