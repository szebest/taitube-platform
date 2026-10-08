import type {
  Channel,
  ChannelCard,
  Playlist,
  SearchMode,
  SearchPosition,
  SearchResultKind,
  SearchSort,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { VideoRecord } from './video-repository';

export interface SearchQuery {
  /** Normalized by `validateSearchQuery`; the adapter parses it, never the caller. */
  text: string;
  kinds: readonly SearchResultKind[];
  sort: SearchSort;
  mode: SearchMode;
  /** The clock recency is scored against, fixed for a whole walk. */
  instant: number;
  /** Narrows videos only; channels and playlists have no category. */
  categoryId: string | null;
  cursor: SearchPosition | null;
  limit: number;
}

export interface PlaylistSearchCard {
  playlist: Playlist;
  owner: ChannelCard | null;
  /** The public ready videos it holds, which is all an anonymous searcher could open. */
  videoCount: number;
  /** The poster of the first of those videos, for a playlist without a custom thumbnail. */
  coverKey: string | null;
}

/** A hit is its own position: `key` is the sort value it was ordered by, `id` its tiebreaker. */
export type SearchHit =
  | { kind: 'video'; key: number; id: string; video: VideoRecord }
  | { kind: 'channel'; key: number; id: string; channel: Channel }
  | { kind: 'playlist'; key: number; id: string; card: PlaylistSearchCard };

export interface SearchPage {
  hits: SearchHit[];
  /** Every match across the kinds asked for, whatever the cursor. */
  total: number;
}

/**
 * Search is a public listing and reads as nobody: a `READY`, `public`, undeleted video, any
 * channel, and a `public` playlist that is not a system one. Nothing a viewer owns privately is
 * ever a hit, so a page, a count and a cached copy mean the same to everyone.
 */
export interface SearchRepositoryPort {
  /** Up to `limit + 1` hits after the cursor, merged across kinds in `compareSearchPositions` order. */
  search(query: SearchQuery): Promise<Result<SearchPage, DatabaseUnavailable>>;
  /**
   * Whether the parsed query narrows anything at all. A negated phrase, `-"lo fi"`, holds words
   * yet parses to a query every row satisfies; only the adapter's parser can tell.
   */
  restricts(text: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Channels whose handle or display name starts with `prefix`, most subscribed first. */
  suggestChannels(prefix: string, limit: number): Promise<Result<Channel[], DatabaseUnavailable>>;
}
