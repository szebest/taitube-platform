import { MS_PER_HOUR, MS_PER_MINUTE } from '@kit/primitives';
import type { SearchMode } from './search';
import type { WatchPartyRoom } from './watch-party';

export const WATCH_PARTY_DISCOVERY_STATUSES = ['all', 'now', 'lobby', 'scheduled'] as const;
type WatchPartyDiscoveryStatus = (typeof WATCH_PARTY_DISCOVERY_STATUSES)[number];

export const WATCH_PARTY_DISCOVERY_ACCESS = ['any', 'open', 'password'] as const;
type WatchPartyDiscoveryAccess = (typeof WATCH_PARTY_DISCOVERY_ACCESS)[number];

export const WATCH_PARTY_DISCOVERY_SIZES = ['any', 'small', 'medium', 'large'] as const;
type WatchPartyDiscoverySize = (typeof WATCH_PARTY_DISCOVERY_SIZES)[number];

export const WATCH_PARTY_DISCOVERY_KINDS = ['any', 'single', 'playlist'] as const;
type WatchPartyDiscoveryKind = (typeof WATCH_PARTY_DISCOVERY_KINDS)[number];

export const WATCH_PARTY_DISCOVERY_SORTS = [
  'members',
  'newest',
  'starting_soon',
  'trending',
] as const;
export type WatchPartyDiscoverySort = (typeof WATCH_PARTY_DISCOVERY_SORTS)[number];

/** Rooms with at most `small` people present are small, up to `medium` medium, and the rest large. */
export const WATCH_PARTY_SIZE_LIMITS = { small: 10, medium: 50 } as const;

export const WATCH_PARTY_TREND = {
  joinWindowMs: 30 * MS_PER_MINUTE,
  ageOffsetHours: 2,
  exponent: 1.2,
} as const;

/** `(joins in the window + present) / (age in hours + 2) ^ 1.2`, written by the sweep each minute. */
export function watchPartyTrendScore(input: {
  readonly recentJoins: number;
  readonly present: number;
  readonly ageMs: number;
}): number {
  const { ageOffsetHours, exponent } = WATCH_PARTY_TREND;
  const ageHours = Math.max(0, input.ageMs) / MS_PER_HOUR;
  return (input.recentJoins + input.present) / (ageHours + ageOffsetHours) ** exponent;
}

/**
 * What discovery's text search reads: the room name, the owner's handle and display name and the
 * current video's title, rewritten whenever one of them changes.
 */
export function watchPartySearchText(parts: {
  readonly name: string;
  readonly ownerHandle: string | null;
  readonly ownerName: string | null;
  readonly videoTitle: string | null;
}): string {
  return [parts.name, parts.ownerHandle, parts.ownerName, parts.videoTitle]
    .filter((part): part is string => part !== null && part.trim() !== '')
    .join(' ');
}

export interface WatchPartyDiscoveryFilters {
  /** A validated search text, or `null` for no search. */
  readonly text: string | null;
  readonly status: WatchPartyDiscoveryStatus;
  readonly categoryId: string | null;
  readonly language: string | null;
  readonly access: WatchPartyDiscoveryAccess;
  readonly size: WatchPartyDiscoverySize;
  readonly space: boolean;
  readonly followed: boolean;
  readonly creator: boolean;
  readonly kind: WatchPartyDiscoveryKind;
}

/** The last room of a page in its sort's key: each sort resumes only from a position of its own. */
export type WatchPartyDiscoveryPosition =
  | { readonly sort: 'members'; readonly key: number; readonly id: string }
  | { readonly sort: 'newest'; readonly key: Date; readonly id: string }
  | { readonly sort: 'starting_soon'; readonly key: Date; readonly id: string }
  | { readonly sort: 'trending'; readonly key: number; readonly id: string };

/** Where a walk resumes after `row`, in the key the sort orders by. */
export function watchPartyDiscoveryPosition(
  sort: WatchPartyDiscoverySort,
  row: {
    readonly room: Pick<WatchPartyRoom, 'id' | 'presentCount' | 'createdAt' | 'scheduledFor'>;
    readonly trendScore: number;
  }
): WatchPartyDiscoveryPosition {
  const { id, presentCount, createdAt, scheduledFor } = row.room;
  switch (sort) {
    case 'members':
      return { sort, key: presentCount, id };
    case 'newest':
      return { sort, key: createdAt, id };
    case 'starting_soon':
      return { sort, key: scheduledFor ?? createdAt, id };
    case 'trending':
      return { sort, key: row.trendScore, id };
  }
}

export interface WatchPartyDiscoveryQuery {
  readonly filters: WatchPartyDiscoveryFilters;
  readonly sort: WatchPartyDiscoverySort;
  readonly mode: SearchMode;
  /** The signed-in viewer: `followed` needs it, and a room that banned them is left out. */
  readonly viewerId: string | null;
  /** The operator's member ceiling, what a room without a capacity of its own is measured against. */
  readonly ceiling: number;
  readonly now: Date;
  readonly after: WatchPartyDiscoveryPosition | null;
  readonly limit: number;
}
