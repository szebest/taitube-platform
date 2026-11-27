import type { Result } from '@kit/result';
import type { SectionSort, SmartPlaylistRules } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export type PoolSourceType = 'videos' | 'shorts' | 'posts' | 'live' | 'playlists';

export type PageItemKind = 'video' | 'post' | 'playlist' | 'live' | 'channel';

export interface PageItemRef {
  kind: PageItemKind;
  id: string;
}

export interface PoolRequest {
  key: string;
  sort: Exclude<SectionSort, 'manual' | 'random'>;
  limit: number;
  tags: readonly string[];
  since: Date | null;
  until: Date | null;
  minDurationSec: number | null;
  maxDurationSec: number | null;
}

export interface PlaylistItemsRequest {
  key: string;
  playlistId: string;
  limit: number;
}

export interface SmartRequest {
  key: string;
  rules: SmartPlaylistRules;
  limit: number;
}

export type RefsByKey = Record<string, PageItemRef[]>;

interface PageItemBase {
  id: string;
  title: string;
  thumbnailKey: string | null;
  createdAt: Date;
  channelId: string | null;
  ownerUserId: string | null;
}

export type PageItemRow =
  | (PageItemBase & {
      kind: 'video';
      format: 'standard' | 'short';
      durationMs: number | null;
      viewsCount: number;
      likesCount: number;
    })
  | (PageItemBase & { kind: 'post'; likesCount: number; commentsCount: number })
  | (PageItemBase & { kind: 'playlist'; itemCount: number })
  | (PageItemBase & {
      kind: 'live';
      status: 'IDLE' | 'LIVE' | 'ENDED';
      viewers: number;
      videoId: string | null;
    })
  | (PageItemBase & { kind: 'channel'; handle: string; avatarUrl: string | null });

/**
 * What the page resolver reads, one statement per call: a call per source type that holds the
 * requests of every section of that type, and one hydration for every id the others collected.
 * Everything answered is public and the channel's own where a source says so.
 */
export interface ChannelPageSourceRepositoryPort {
  pool(
    channelId: string,
    ownerUserId: string,
    type: PoolSourceType,
    requests: readonly PoolRequest[]
  ): Promise<Result<RefsByKey, DatabaseUnavailable>>;
  /** The videos of the public playlists named, in their position order. */
  playlistItems(
    requests: readonly PlaylistItemsRequest[]
  ): Promise<Result<RefsByKey, DatabaseUnavailable>>;
  /** Each rules document evaluated over the channel's own public videos. */
  smart(
    channelId: string,
    requests: readonly SmartRequest[],
    now: Date
  ): Promise<Result<RefsByKey, DatabaseUnavailable>>;
  /** The pins that still qualify in order, else the most viewed public uploads. */
  startHere(channelId: string, limit: number): Promise<Result<PageItemRef[], DatabaseUnavailable>>;
  /** The public ones among `refs`; an id that is private, gone or not ready is absent. */
  hydrate(refs: readonly PageItemRef[]): Promise<Result<PageItemRow[], DatabaseUnavailable>>;
}
