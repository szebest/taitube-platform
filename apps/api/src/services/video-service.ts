import type { VideoRepository, VideoStatus } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { AuthUser } from '../plugins/auth.js';

export interface VideoRenditionView {
  name: string;
  status: string;
  playlistUrl?: string;
}

export interface VideoDetailView {
  id: string;
  title: string | null;
  description: string | null;
  visibility: string;
  status: string;
  progress: {
    overall: number;
    byRendition: Record<string, number>;
  };
  durationMs?: number;
  width?: number;
  height?: number;
  ladder?: Array<{
    name: string;
    width: number;
    height: number;
    videoKbps: number;
    audioKbps: number;
  }>;
  renditions: VideoRenditionView[];
  playbackUrl?: string;
  posterUrl?: string;
  spriteUrl?: string;
  spriteVttUrl?: string;
  error?: {
    code: string;
    message: string;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}

export interface VideoServiceDeps {
  videos: VideoRepository;
  cdnBaseUrl?: string;
}

/**
 * VideoService — Deep domain module for video retrieval and projections (SDD §6.1, §6.3).
 *
 * Encapsulates:
 * 1. Privacy & visibility access control (unlisted/public vs owner/admin private)
 * 2. CDN asset URL derivation (playback, poster, sprite, vtt)
 * 3. Rendition progress aggregation and RFC-compliant response projection
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
   * Retrieves video details and enforces visibility access control.
   */
  async get(user: AuthUser | null, videoId: string): Promise<VideoDetailView> {
    const details = await this.videos.findWithDetails(videoId);
    if (!details) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
    }

    const { video, renditions: videoRenditions } = details;

    // Access control (SDD §6.1, §11, AC 2):
    // - If private: must be authenticated and owner (or admin); other owner + private -> 404
    // - If unlisted or public: viewable by anyone -> 200
    if (video.visibility === 'private') {
      if (!user) {
        throw new PermanentError(
          ErrorCodes.UNAUTHORIZED,
          'Authentication required to view private video'
        );
      }

      if (user.id !== video.ownerId && user.role !== 'admin') {
        // Do not leak existence: return 404 VIDEO_NOT_FOUND for non-owners
        throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
      }
    }

    const isReady = video.status === 'READY';
    const byRendition: Record<string, number> = {};
    for (const r of videoRenditions) {
      byRendition[r.name] = r.status === 'DONE' ? 100 : 0;
    }

    const renditionsResponse = videoRenditions.map((r) => ({
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
      visibility: video.visibility,
      status: video.status,
      progress: {
        overall: isReady ? 100 : 0,
        byRendition,
      },
      durationMs: video.durationMs ?? undefined,
      width: video.width ?? undefined,
      height: video.height ?? undefined,
      ladder:
        (video.ladder as unknown as Array<{
          name: string;
          width: number;
          height: number;
          videoKbps: number;
          audioKbps: number;
        }>) ?? undefined,
      renditions: renditionsResponse,
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
   * Soft deletes a video (SDD §6.1, §9.8, Ticket 17 AC 4).
   * Enforces ownership/admin check, transitions status to DELETED, and sets deletedAt.
   */
  async softDelete(
    user: AuthUser,
    videoId: string
  ): Promise<{ videoId: string; status: 'DELETED' }> {
    const video = await this.videos.findById(videoId);
    if (!video) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
    }

    if (user.role !== 'admin' && video.ownerId !== user.id) {
      throw new PermanentError(
        ErrorCodes.FORBIDDEN,
        'Only the video owner or an admin may delete this video'
      );
    }

    if (video.status === 'DELETED') {
      return { videoId, status: 'DELETED' };
    }

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
