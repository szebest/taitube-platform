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

export interface ChannelPageSourceRepositoryPort {
  pool(
    channelId: string,
    ownerUserId: string,
    type: PoolSourceType,
    requests: readonly PoolRequest[]
  ): Promise<Result<RefsByKey, DatabaseUnavailable>>;
  playlistItems(
    requests: readonly PlaylistItemsRequest[]
  ): Promise<Result<RefsByKey, DatabaseUnavailable>>;
  smart(
    channelId: string,
    requests: readonly SmartRequest[],
    now: Date
  ): Promise<Result<RefsByKey, DatabaseUnavailable>>;
  startHere(channelId: string, limit: number): Promise<Result<PageItemRef[], DatabaseUnavailable>>;
  hydrate(refs: readonly PageItemRef[]): Promise<Result<PageItemRow[], DatabaseUnavailable>>;
}
