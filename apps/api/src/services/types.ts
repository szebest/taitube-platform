import type { RenditionRecord, VideoRecord, VideoRepository, VideoStatus } from '@vp/core/ports';

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

/**
 * Maps a core VideoRecord domain model into a client-facing VideoSummaryView.
 */
export function toVideoSummaryView(v: VideoRecord, cleanCdnBase: string): VideoSummaryView {
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    visibility: v.visibility as VideoVisibility,
    status: v.status,
    durationMs: v.durationMs ?? undefined,
    posterUrl: v.posterKey ? `${cleanCdnBase}/${v.posterKey.replace(/^\/+/, '')}` : undefined,
    playbackUrl:
      v.status === 'READY'
        ? `${cleanCdnBase}/${(v.masterPlaylistKey || `videos/${v.id}/hls/master.m3u8`).replace(/^\/+/, '')}`
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
  };
}

/**
 * Maps a core VideoRecord and renditions into a client-facing VideoDetailView.
 */
export function toVideoDetailView(
  video: VideoRecord,
  videoRenditions: RenditionRecord[],
  cleanCdnBase: string,
  events?: Array<{ type: string; payload: unknown }>
): VideoDetailView {
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

  if (events) {
    for (const ev of events) {
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
    playlistUrl: r.playlistKey ? `${cleanCdnBase}/${r.playlistKey.replace(/^\/+/, '')}` : undefined,
  }));

  return {
    id: video.id,
    title: video.title,
    description: video.description,
    visibility: video.visibility as VideoVisibility,
    status: video.status,
    progress: { overall, byRendition },
    durationMs: video.durationMs ?? undefined,
    width: video.width ?? undefined,
    height: video.height ?? undefined,
    fps: video.fps ? Number(video.fps) : undefined,
    ladder: (video.ladder as VideoDetailView['ladder']) ?? undefined,
    renditions,
    playbackUrl: isReady
      ? `${cleanCdnBase}/${(video.masterPlaylistKey || `videos/${video.id}/hls/master.m3u8`).replace(/^\/+/, '')}`
      : undefined,
    posterUrl: video.posterKey
      ? `${cleanCdnBase}/${video.posterKey.replace(/^\/+/, '')}`
      : undefined,
    spriteUrl: video.spriteKey
      ? `${cleanCdnBase}/${video.spriteKey.replace(/^\/+/, '')}`
      : undefined,
    spriteVttUrl: video.spriteKey
      ? `${cleanCdnBase}/${video.spriteKey.replace(/\.[^.]+$/, '.vtt').replace(/^\/+/, '')}`
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
