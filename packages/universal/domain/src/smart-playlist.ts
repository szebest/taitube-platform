import type { VideoFormat } from './status-vocabulary';

export const SMART_PLAYLIST_MATCHES = ['all', 'any'] as const;
type SmartPlaylistMatch = (typeof SMART_PLAYLIST_MATCHES)[number];

export const SMART_PLAYLIST_SORTS = ['newest', 'oldest', 'popular', 'shortest', 'longest'] as const;
export type SmartPlaylistSort = (typeof SMART_PLAYLIST_SORTS)[number];

export const SMART_PLAYLIST_FORMATS = ['long', 'short'] as const;
export type SmartPlaylistFormat = (typeof SMART_PLAYLIST_FORMATS)[number];

export const SMART_PLAYLIST_MAX_CONDITIONS = 8;
export const SMART_PLAYLIST_MAX_CHANNELS = 20;
export const SMART_PLAYLIST_MAX_TAGS = 5;
export const SMART_PLAYLIST_MAX_LIMIT = 200;
export const SMART_PLAYLIST_CACHE_SECONDS = 60;

export type SmartPlaylistDuration =
  | { readonly op: 'under'; readonly seconds: number }
  | { readonly op: 'over'; readonly seconds: number }
  | { readonly op: 'between'; readonly minSeconds: number; readonly maxSeconds: number };

export type SmartPlaylistCondition =
  | { readonly field: 'channel'; readonly channelIds: string[] }
  | { readonly field: 'tag'; readonly tags: string[] }
  | { readonly field: 'category'; readonly categoryId: string }
  | { readonly field: 'duration'; readonly duration: SmartPlaylistDuration }
  | { readonly field: 'format'; readonly format: SmartPlaylistFormat }
  | { readonly field: 'newer_than'; readonly days: number }
  | { readonly field: 'unwatched' };

export interface SmartPlaylistRules {
  readonly match: SmartPlaylistMatch;
  readonly conditions: SmartPlaylistCondition[];
  readonly sort: SmartPlaylistSort;
  readonly limit: number;
}

/** The column a smart sort compares and its direction, the same in both adapters. */
export const SMART_PLAYLIST_SORT_KEYS: Readonly<
  Record<SmartPlaylistSort, { key: 'createdAt' | 'views' | 'duration'; order: 'asc' | 'desc' }>
> = {
  newest: { key: 'createdAt', order: 'desc' },
  oldest: { key: 'createdAt', order: 'asc' },
  popular: { key: 'views', order: 'desc' },
  shortest: { key: 'duration', order: 'asc' },
  longest: { key: 'duration', order: 'desc' },
};

export const SMART_PLAYLIST_VIDEO_FORMATS: Readonly<Record<SmartPlaylistFormat, VideoFormat>> = {
  long: 'standard',
  short: 'short',
};

/** Only `unwatched` reads the viewer; a guest has watched nothing, so for them it matches all. */
export function dependsOnViewer(rules: SmartPlaylistRules, viewerId: string | null): boolean {
  return viewerId !== null && rules.conditions.some(({ field }) => field === 'unwatched');
}
