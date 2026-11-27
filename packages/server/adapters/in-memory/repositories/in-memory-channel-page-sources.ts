import { MS_PER_SECOND } from '@kit/primitives';
import { type Result, assertNever, isErr, ok } from '@kit/result';
import type {
  ChannelFeaturedRepositoryPort,
  ChannelPageSourceRepositoryPort,
  ChannelRepositoryPort,
  PageItemRef,
  PageItemRow,
  PlaylistItemsRequest,
  PoolRequest,
  PoolSourceType,
  RefsByKey,
  SmartPlaylistRepositoryPort,
  SmartRequest,
} from '@vp/core/repositories';
import {
  type ChannelPost,
  type LiveStream,
  type Playlist,
  type Video,
  isChannelPageStream,
  isPostPublished,
  isPublicFeedEligible,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { hydrateRow, videoIdsOf } from './in-memory-channel-page-rows';

interface PoolRow {
  id: string;
  createdAt: Date;
  views: number;
  likes: number;
  video: Video | null;
}

export interface InMemoryChannelPageSourcesDeps {
  videos: () => { getAllVideos(): readonly Video[] };
  posts: () => { readonly posts: ReadonlyMap<string, ChannelPost> };
  playlists: () => {
    getAllPlaylists(): readonly Playlist[];
    rowsOf(playlistId: string): readonly { kind: string; videoId: string | null }[];
  };
  live: () => { getAll(): readonly LiveStream[] };
  channels: () => Pick<ChannelRepositoryPort, 'findById'>;
  featured: () => Pick<ChannelFeaturedRepositoryPort, 'listForChannel'>;
  smart: () => Pick<SmartPlaylistRepositoryPort, 'evaluate'>;
}

function matches(row: PoolRow, request: PoolRequest): boolean {
  const { video } = row;
  if (request.since && row.createdAt < request.since) return false;
  if (request.until && row.createdAt > request.until) return false;
  if (!video) return true;
  const seconds = video.durationMs === null ? null : video.durationMs / MS_PER_SECOND;
  if (request.tags.length > 0 && !request.tags.some((tag) => video.tags?.includes(tag))) {
    return false;
  }
  if (request.minDurationSec !== null && (seconds === null || seconds < request.minDurationSec)) {
    return false;
  }
  return !(
    request.maxDurationSec !== null &&
    (seconds === null || seconds > request.maxDurationSec)
  );
}

function ranked(rows: PoolRow[], request: PoolRequest): PoolRow[] {
  const keyOf = (row: PoolRow): number => {
    switch (request.sort) {
      case 'popular':
        return row.views;
      case 'most_liked':
        return row.likes;
      case 'newest':
      case 'oldest':
        return row.createdAt.getTime();
      default:
        return assertNever(request.sort, 'PoolRequestSort');
    }
  };
  const sign = request.sort === 'oldest' ? 1 : -1;
  return rows
    .filter((row) => matches(row, request))
    .sort((a, b) => sign * (keyOf(a) - keyOf(b)) || sign * a.id.localeCompare(b.id))
    .slice(0, request.limit);
}

export class InMemoryChannelPageSources implements ChannelPageSourceRepositoryPort {
  constructor(private readonly deps: InMemoryChannelPageSourcesDeps) {}

  async pool(
    channelId: string,
    ownerUserId: string,
    type: PoolSourceType,
    requests: readonly PoolRequest[]
  ): Promise<Result<RefsByKey, DatabaseUnavailable>> {
    const candidates = this.candidates(channelId, ownerUserId, type);
    const found: RefsByKey = {};
    for (const request of requests) {
      found[request.key] = ranked(candidates.rows, request).map(({ id }) => ({
        kind: candidates.kind,
        id,
      }));
    }
    return ok(found);
  }

  async playlistItems(
    requests: readonly PlaylistItemsRequest[]
  ): Promise<Result<RefsByKey, DatabaseUnavailable>> {
    const publicVideos = new Set(
      this.deps
        .videos()
        .getAllVideos()
        .filter((video) => isPublicFeedEligible(video))
        .map(({ id }) => id)
    );
    const { playlists } = this.deps;
    const found: RefsByKey = {};
    for (const { key, playlistId, limit } of requests) {
      const playlist = playlists()
        .getAllPlaylists()
        .find(({ id }) => id === playlistId);
      found[key] =
        playlist?.visibility === 'public'
          ? videoIdsOf(playlists().rowsOf(playlistId))
              .filter((id) => publicVideos.has(id))
              .slice(0, limit)
              .map((id) => ({ kind: 'video' as const, id }))
          : [];
    }
    return ok(found);
  }

  async smart(
    channelId: string,
    requests: readonly SmartRequest[],
    now: Date
  ): Promise<Result<RefsByKey, DatabaseUnavailable>> {
    const found: RefsByKey = {};
    for (const { key, rules, limit } of requests) {
      const evaluated = await this.deps
        .smart()
        .evaluate(rules, null, { cursor: null, limit: rules.limit, now });
      if (isErr(evaluated)) return evaluated;
      found[key] = evaluated.value
        .filter(({ video }) => video.channelId === channelId)
        .slice(0, limit)
        .map(({ video }) => ({ kind: 'video' as const, id: video.id }));
    }
    return ok(found);
  }

  async startHere(
    channelId: string,
    limit: number
  ): Promise<Result<PageItemRef[], DatabaseUnavailable>> {
    const own = this.deps
      .videos()
      .getAllVideos()
      .filter((video) => isPublicFeedEligible(video, { channelId }));
    const pinned = await this.deps.featured().listForChannel(channelId);
    if (isErr(pinned)) return pinned;
    const qualifying = pinned.value.filter((id) => own.some((video) => video.id === id));
    const ids =
      qualifying.length > 0
        ? qualifying
        : own
            .toSorted(
              (a, b) => (b.viewsCount ?? 0) - (a.viewsCount ?? 0) || b.id.localeCompare(a.id)
            )
            .map(({ id }) => id);
    return ok(ids.slice(0, limit).map((id) => ({ kind: 'video' as const, id })));
  }

  async hydrate(refs: readonly PageItemRef[]): Promise<Result<PageItemRow[], DatabaseUnavailable>> {
    const rows: PageItemRow[] = [];
    for (const ref of refs) {
      const row = await hydrateRow(this.deps, ref);
      if (row) rows.push(row);
    }
    return ok(rows);
  }

  clear(): void {}

  private candidates(
    channelId: string,
    ownerUserId: string,
    type: PoolSourceType
  ): { kind: PageItemRef['kind']; rows: PoolRow[] } {
    switch (type) {
      case 'videos':
      case 'shorts':
        return {
          kind: 'video',
          rows: this.deps
            .videos()
            .getAllVideos()
            .filter((video) =>
              isPublicFeedEligible(video, {
                channelId,
                format: type === 'shorts' ? 'short' : 'standard',
              })
            )
            .map((video) => ({
              id: video.id,
              createdAt: video.createdAt,
              views: video.viewsCount ?? 0,
              likes: video.likesCount ?? 0,
              video,
            })),
        };
      case 'posts':
        return {
          kind: 'post',
          rows: [...this.deps.posts().posts.values()]
            .filter((post) => post.channelId === channelId && isPostPublished(post.status))
            .map((post) => ({
              id: post.id,
              createdAt: post.publishedAt ?? post.createdAt,
              views: post.likeCount,
              likes: post.likeCount,
              video: null,
            })),
        };
      case 'live':
        return {
          kind: 'live',
          rows: this.deps
            .live()
            .getAll()
            .filter((stream) => stream.channelId === channelId && isChannelPageStream(stream))
            .map((stream) => ({
              id: stream.id,
              createdAt: stream.startedAt ?? stream.createdAt,
              views: stream.currentViewers,
              likes: stream.currentViewers,
              video: null,
            })),
        };
      case 'playlists':
        return {
          kind: 'playlist',
          rows: this.deps
            .playlists()
            .getAllPlaylists()
            .filter(
              (playlist) =>
                playlist.ownerId === ownerUserId &&
                playlist.visibility === 'public' &&
                !playlist.isSystem
            )
            .map((playlist) => ({
              id: playlist.id,
              createdAt: playlist.updatedAt,
              views: 0,
              likes: 0,
              video: null,
            })),
        };
      default:
        return assertNever(type, 'PoolSourceType');
    }
  }
}
