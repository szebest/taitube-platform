import type { VideoStatus, VideoVisibility } from './status-vocabulary';

/**
 * The canonical video entity. `@vp/core`'s `VideoRecord` aliases this rather than restating it,
 * so a rule in `@vp/domain-rules` and a repository in `@vp/core` are talking about one shape.
 */
export interface Video {
  id: string;
  ownerId: string;
  title: string | null;
  description: string | null;
  visibility: VideoVisibility;
  status: VideoStatus;
  sourceKey: string;
  sourceSizeBytes: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  fps?: number | null;
  ladder: unknown;
  masterPlaylistKey?: string | null;
  posterKey?: string | null;
  spriteKey?: string | null;
  playbackUrl?: string | null;
  posterUrl?: string | null;
  spriteUrl?: string | null;
  spriteVttUrl?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  viewsCount?: number;
  commentsCount?: number;
  likesCount?: number;
  dislikesCount?: number;
  categoryId?: string | null;
  tags?: string[];
  customThumbnailKey?: string | null;
  generation: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  readyAt: Date | null;
  deletedAt?: Date | null;
}

/** One member until a custom upload exists; a `custom` member is added beside it then. */
export type ThumbnailSelection = { source: 'poster' };
