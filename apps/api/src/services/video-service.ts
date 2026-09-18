import type { VideoRepository, VideoStatus } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { AuthUser } from '../plugins/auth';

export type VideoVisibility = 'private' | 'unlisted' | 'public';

export interface VideoLadderEntry {
  name: string;
  width: number;
  height: number;
  videoKbps?: number;
  audioKbps?: number;
}

export interface VideoProgressView {
  overall: number;
  byRendition: Record<string, number>;
}

export interface VideoErrorView {
  code: string;
  message: string;
}

export interface VideoRenditionView {
  name: string;
  status: string;
  playlistUrl?: string;
}

export interface VideoDetailView {
  id: string;
  title: string | null;
  description: string | null;
  visibility: VideoVisibility;
  status: VideoStatus;
  progress: VideoProgressView;
  durationMs?: number;
  width?: number;
  height?: number;
  fps?: number;
  ladder?: VideoLadderEntry[];
  renditions: VideoRenditionView[];
  playbackUrl?: string;
  posterUrl?: string;
  spriteUrl?: string;
  spriteVttUrl?: string;
  error?: VideoErrorView;
  version: number;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}

export interface VideoSummaryView {
  id: string;
  title: string | null;
  description: string | null;
  visibility: VideoVisibility;
  status: VideoStatus;
  durationMs?: number;
  posterUrl?: string;
  playbackUrl?: string;
  viewsCount?: number;
  categoryId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}

export interface VideoServiceDeps {
  videos: VideoRepository;
  cdnBaseUrl?: string;
}

export {
  encodeVideoCursor,
  decodeVideoCursor,
  encodeFeedCursor,
  decodeFeedCursor,
  type FeedSort,
} from './cursor';

import {
  decodeFeedCursor,
  decodeVideoCursor,
  encodeFeedCursor,
  encodeVideoCursor,
  type FeedSort,
} from './cursor';

/**
 * VideoService — Deep domain module for video operations and projections (SDD §6.1, §6.3).
 */
export class VideoService {
  private readonly videos: VideoRepository;
  private readonly cleanCdnBase: string;

  constructor(deps: VideoServiceDeps) {
    this.videos = deps.videos;
    const cdnBase =
      deps.cdnBaseUrl || process.env['CDN_BASE_URL'] || 'http://localhost:9000/public';
    this.cleanCdnBase = cdnBase.replace(/\/+$/, '');
  }

  /**
   * Keyset paginated video list scoped to caller (SDD §6.1, PRD US-12).
   */
  async list(
    user: AuthUser,
    options: { cursor?: string; limit?: number; status?: VideoStatus }
  ): Promise<{ items: VideoSummaryView[]; nextCursor: string | null }> {
    const decodedCursor = decodeVideoCursor(options.cursor);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const rows = await this.videos.listByOwner({
      ownerId: user.id,
      cursor: decodedCursor,
      limit,
      status: options.status,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1] : undefined;
    const nextCursor = lastRow ? encodeVideoCursor(lastRow) : null;

    const items: VideoSummaryView[] = pageRows.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      visibility: v.visibility as 'private' | 'unlisted' | 'public',
      status: v.status,
      durationMs: v.durationMs ?? undefined,
      posterUrl: v.posterKey
        ? `${this.cleanCdnBase}/${v.posterKey.replace(/^\/+/, '')}`
        : undefined,
      playbackUrl:
        v.status === 'READY'
          ? `${this.cleanCdnBase}/${(v.masterPlaylistKey || `videos/${v.id}/hls/master.m3u8`).replace(/^\/+/, '')}`
          : undefined,
      version: v.version,
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
      updatedAt: v.updatedAt instanceof Date ? v.updatedAt.toISOString() : String(v.updatedAt),
      readyAt: v.readyAt
        ? v.readyAt instanceof Date
          ? v.readyAt.toISOString()
          : String(v.readyAt)
        : undefined,
    }));

    return { items, nextCursor };
  }

  /**
   * Keyset paginated public video feed (PRD US-12, FR-14, SDD §6.1).
   * Unauthenticated: queries visibility = 'public' AND status = 'READY'.
   */
  async listPublic(options: {
    sort?: FeedSort;
    categoryId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: VideoSummaryView[]; nextCursor: string | null; total: number }> {
    const sort = options.sort ?? 'recent';
    const decodedCursor = decodeFeedCursor(options.cursor);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const result = await this.videos.listPublic({
      sort,
      categoryId: options.categoryId,
      cursor: decodedCursor,
      limit,
    });

    const hasMore = result.items.length > limit;
    const pageRows = hasMore ? result.items.slice(0, limit) : result.items;
    const lastRow = hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1] : undefined;

    let nextCursor: string | null = null;
    if (lastRow) {
      let score: number | undefined;
      if (sort === 'trending') {
        const ageHours = Math.max(0, (Date.now() - lastRow.createdAt.getTime()) / 3600000);
        score = ((lastRow.viewsCount ?? 0) + 1) / (ageHours + 2) ** 1.5;
      }
      nextCursor = encodeFeedCursor(lastRow, sort, score);
    }

    const items: VideoSummaryView[] = pageRows.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      visibility: v.visibility as 'private' | 'unlisted' | 'public',
      status: v.status,
      durationMs: v.durationMs ?? undefined,
      posterUrl: v.posterKey
        ? `${this.cleanCdnBase}/${v.posterKey.replace(/^\/+/, '')}`
        : undefined,
      playbackUrl:
        v.status === 'READY'
          ? `${this.cleanCdnBase}/${(v.masterPlaylistKey || `videos/${v.id}/hls/master.m3u8`).replace(/^\/+/, '')}`
          : undefined,
      viewsCount: v.viewsCount ?? 0,
      categoryId: v.categoryId ?? null,
      version: v.version,
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
      updatedAt: v.updatedAt instanceof Date ? v.updatedAt.toISOString() : String(v.updatedAt),
      readyAt: v.readyAt
        ? v.readyAt instanceof Date
          ? v.readyAt.toISOString()
          : String(v.readyAt)
        : undefined,
    }));

    return { items, nextCursor, total: result.total };
  }

  /**
   * Retrieves video details and enforces visibility access control (SDD §6.1, §11).
   */
  async get(user: AuthUser | null, videoId: string): Promise<VideoDetailView> {
    const details = await this.videos.findWithDetails(videoId);
    if (!details)
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

    const { video, renditions: videoRenditions } = details;

    if (video.visibility === 'private') {
      if (!user)
        throw new PermanentError(
          ErrorCodes.UNAUTHORIZED,
          'Authentication required to view private video'
        );
      if (user.id !== video.ownerId && user.role !== 'admin') {
        throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
      }
    }

    const isReady = video.status === 'READY';
    const byRendition: Record<string, number> = {};

    if (Array.isArray(video.ladder)) {
      for (const rung of video.ladder as Array<{ name: string }>) {
        if (rung?.name) byRendition[rung.name] = isReady ? 100 : 0;
      }
    }

    for (const r of videoRenditions) {
      byRendition[r.name] = isReady || r.status === 'DONE' ? 100 : 0;
    }

    if (details.events) {
      for (const ev of details.events) {
        if ((ev.type === 'progress' || ev.type === 'transcode.progress') && ev.payload) {
          const p = ev.payload as { rendition?: string; percent?: number };
          if (p.rendition && typeof p.percent === 'number' && byRendition[p.rendition] !== 100) {
            byRendition[p.rendition] = Math.max(byRendition[p.rendition] ?? 0, p.percent);
          }
        }
      }
    }

    let overall = isReady ? 100 : 0;
    if (!isReady) {
      const keys = Object.keys(byRendition);
      if (keys.length > 0) {
        const sum = keys.reduce((acc, k) => acc + (byRendition[k] ?? 0), 0);
        overall = Math.round(sum / keys.length);
      }
    }

    const renditions = videoRenditions.map((r) => ({
      name: r.name,
      status: r.status,
      playlistUrl: r.playlistKey
        ? `${this.cleanCdnBase}/${r.playlistKey.replace(/^\/+/, '')}`
        : undefined,
    }));

    return {
      id: video.id,
      title: video.title,
      description: video.description,
      visibility: video.visibility as 'private' | 'unlisted' | 'public',
      status: video.status,
      progress: { overall, byRendition },
      durationMs: video.durationMs ?? undefined,
      width: video.width ?? undefined,
      height: video.height ?? undefined,
      fps: video.fps ? Number(video.fps) : undefined,
      ladder: (video.ladder as VideoDetailView['ladder']) ?? undefined,
      renditions,
      playbackUrl: isReady
        ? `${this.cleanCdnBase}/${(video.masterPlaylistKey || `videos/${video.id}/hls/master.m3u8`).replace(/^\/+/, '')}`
        : undefined,
      posterUrl: video.posterKey
        ? `${this.cleanCdnBase}/${video.posterKey.replace(/^\/+/, '')}`
        : undefined,
      spriteUrl: video.spriteKey
        ? `${this.cleanCdnBase}/${video.spriteKey.replace(/^\/+/, '')}`
        : undefined,
      spriteVttUrl: video.spriteKey
        ? `${this.cleanCdnBase}/${video.spriteKey.replace(/\.[^.]+$/, '.vtt').replace(/^\/+/, '')}`
        : undefined,
      error: video.errorCode
        ? { code: video.errorCode, message: video.errorMessage || '' }
        : undefined,
      version: video.version,
      createdAt:
        video.createdAt instanceof Date ? video.createdAt.toISOString() : String(video.createdAt),
      updatedAt:
        video.updatedAt instanceof Date ? video.updatedAt.toISOString() : String(video.updatedAt),
      readyAt: video.readyAt
        ? video.readyAt instanceof Date
          ? video.readyAt.toISOString()
          : String(video.readyAt)
        : undefined,
    };
  }

  /**
   * Updates video metadata with optimistic locking on version (SDD §6.1).
   */
  async updateMetadata(
    user: AuthUser,
    videoId: string,
    input: {
      title?: string | null;
      description?: string | null;
      visibility?: 'private' | 'unlisted' | 'public';
      version: number;
    }
  ): Promise<VideoDetailView> {
    const existing = await this.videos.findById(videoId);
    if (!existing)
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

    if (user.role !== 'admin' && existing.ownerId !== user.id) {
      if (existing.visibility === 'private') {
        throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
      }
      throw new PermanentError(
        ErrorCodes.FORBIDDEN,
        'Only the video owner or an admin may edit video metadata'
      );
    }

    if (existing.version !== input.version) {
      throw new PermanentError(
        ErrorCodes.VERSION_CONFLICT,
        `Version conflict on video ${videoId}: expected version ${input.version}, got ${existing.version}`
      );
    }

    const patch: {
      title?: string | null;
      description?: string | null;
      visibility?: 'private' | 'unlisted' | 'public';
    } = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.visibility !== undefined) patch.visibility = input.visibility;

    try {
      await this.videos.updateMetadata({
        videoId,
        expectedVersion: input.version,
        patch,
        userId: user.id,
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'VERSION_CONFLICT') {
        throw new PermanentError(ErrorCodes.VERSION_CONFLICT, (err as Error).message);
      }
      throw err;
    }

    return this.get(user, videoId);
  }

  /**
   * Soft deletes a video (SDD §6.1, §9.8, Ticket 17 AC 4).
   */
  async softDelete(
    user: AuthUser,
    videoId: string
  ): Promise<{ videoId: string; status: 'DELETED' }> {
    const video = await this.videos.findById(videoId);
    if (!video) throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

    if (user.role !== 'admin' && video.ownerId !== user.id) {
      throw new PermanentError(
        ErrorCodes.FORBIDDEN,
        'Only the video owner or an admin may delete this video'
      );
    }

    if (video.status === 'DELETED') return { videoId, status: 'DELETED' };

    const allowedFrom: VideoStatus[] = [
      'UPLOADING',
      'UPLOADED',
      'PROBING',
      'PROCESSING',
      'READY',
      'FAILED',
      'REJECTED',
      'ABANDONED',
    ];

    const transitioned = await this.videos.transition({
      videoId,
      from: allowedFrom,
      to: 'DELETED',
      eventType: 'video.deleted',
      eventPayload: { requestedBy: user.id },
      patch: { deletedAt: new Date() },
    });

    if (!transitioned) {
      throw new PermanentError(
        ErrorCodes.VERSION_CONFLICT,
        'State conflict while transitioning video to DELETED'
      );
    }

    return { videoId, status: 'DELETED' };
  }
}
