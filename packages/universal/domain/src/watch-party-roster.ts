import type { WatchPartyVisibility } from './watch-party';
import type { MemberKind } from './watch-party-principal';

export const ROSTER_SOURCES = ['app', 'activity', 'discord_chat'] as const;
export type RosterSource = (typeof ROSTER_SOURCES)[number];

export const ROSTER_SYNC_STATES = ['lobby', 'in_sync', 'catching_up', 'buffering'] as const;
export type RosterSyncState = (typeof ROSTER_SYNC_STATES)[number];

export const ROSTER_VOICE_STATES = [
  'off',
  'listening',
  'live',
  'self_muted',
  'server_muted',
] as const;
export type RosterVoiceState = (typeof ROSTER_VOICE_STATES)[number];

/** One person in the party, whatever path they came by. */
export interface RosterEntry {
  readonly memberKey: string;
  readonly kind: MemberKind;
  readonly source: RosterSource;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly roleIds: readonly string[];
  readonly ready: boolean;
  readonly sync: RosterSyncState;
  readonly voice: RosterVoiceState;
  readonly away: boolean;
}

export interface RosterView {
  readonly entries: readonly RosterEntry[];
  /** Guests left out of `entries`, counted instead. */
  readonly guests: number;
}

/** Guests collapse into one count for everyone but those who may remove them. */
export function rosterFor(entries: readonly RosterEntry[], seesGuests: boolean): RosterView {
  if (seesGuests) return { entries, guests: 0 };
  const listed = entries.filter((entry) => entry.kind !== 'guest');
  return { entries: listed, guests: entries.length - listed.length };
}

/** Where a preview is shown: the app's surfaces, Discord's embeds, or the invite notification. */
export type RosterPreviewSurface = 'app' | 'discord' | 'invite';

export interface RosterPreviewMember {
  readonly kind: MemberKind;
  readonly name: string;
  readonly avatarUrl: string | null;
  /** An account's `privacy.showInParties`; read for accounts only. */
  readonly showInParties: boolean;
}

export interface RosterPreview {
  readonly faces: readonly { readonly name: string; readonly avatarUrl: string | null }[];
  /** Accounts not shown as a face. */
  readonly others: number;
  readonly discord: number;
  readonly guests: number;
  readonly total: number;
}

export const ROSTER_PREVIEW_FACES = 5;
export const INVITE_PREVIEW_NAMES = 2;

function faceLimit(visibility: WatchPartyVisibility, surface: RosterPreviewSurface): number {
  if (surface === 'invite') return INVITE_PREVIEW_NAMES;
  return visibility === 'private' ? 0 : ROSTER_PREVIEW_FACES;
}

function mayShow(member: RosterPreviewMember, surface: RosterPreviewSurface): boolean {
  switch (member.kind) {
    case 'user':
      return member.showInParties;
    case 'discord':
      return surface === 'discord';
    case 'guest':
      return false;
  }
}

/** The one projection every surface outside the room shows: a few faces who allow it, everyone else counted. */
export function toRosterPreview(
  members: readonly RosterPreviewMember[],
  visibility: WatchPartyVisibility,
  surface: RosterPreviewSurface
): RosterPreview {
  const shown = members
    .filter((member) => mayShow(member, surface))
    .slice(0, faceLimit(visibility, surface));
  const counted = members.filter((member) => !shown.includes(member));
  const count = (kind: MemberKind) => counted.filter((member) => member.kind === kind).length;
  return {
    faces: shown.map(({ name, avatarUrl }) => ({ name, avatarUrl })),
    others: count('user'),
    discord: count('discord'),
    guests: count('guest'),
    total: members.length,
  };
}
