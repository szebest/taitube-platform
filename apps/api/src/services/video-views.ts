import type { RenditionRecord, VideoRecord } from '@vp/core/repositories';
import type { VideoStatus, VideoVisibility } from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import { masterPlaylistKey } from '@vp/storage';

interface VideoLadderEntry {
  name: string;
  width: number;
  height: number;
  videoKbps?: number;
  audioKbps?: number;
}

interface VideoProgressView {
  overall: number;
  byRendition: Record<string, number>;
}

interface VideoErrorView {
  code: string;
  message: string;
}

interface VideoRenditionView {
  name: string;
  status: string;
  playlistUrl?: string;
}

export interface VideoDetailView {
  id: string;
  ownerId: string;
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
  likesCount: number;
  dislikesCount: number;
  error?: VideoErrorView;
  version: number;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}

export interface VideoSummaryView {
  id: string;
  ownerId: string;
  title: string | null;
  description: string | null;
  visibility: VideoVisibility;
  status: VideoStatus;
  durationMs?: number;
  posterUrl?: string;
  playbackUrl?: string;
  viewsCount?: number;
  likesCount?: number;
  dislikesCount?: number;
  categoryId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  readyAt?: string;
}

export function cdnUrl(cdn: CdnBase, key: string): string {
  return `${cdn}/${key.replace(/^\/+/, '')}`;
}

function isoOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export interface PlayableVideo {
  id: string;
  status: VideoStatus;
  masterPlaylistKey?: string | null;
}

/**
 * The HLS entry point a player is handed. Only a READY video has one, and the
 * key is a fallback for rows written before the packager recorded it.
 */
export function playbackUrl(video: PlayableVideo, cdn: CdnBase): string | undefined {
  if (video.status !== 'READY') return undefined;
  return cdnUrl(cdn, video.masterPlaylistKey || masterPlaylistKey(video.id));
}

export function toVideoSummaryView(v: VideoRecord, cdn: CdnBase): VideoSummaryView {
  return {
    id: v.id,
    ownerId: v.ownerId,
    title: v.title,
    description: v.description,
    visibility: v.visibility as VideoVisibility,
    status: v.status,
    durationMs: v.durationMs ?? undefined,
    posterUrl: v.posterKey ? cdnUrl(cdn, v.posterKey) : undefined,
    playbackUrl: playbackUrl(v, cdn),
    viewsCount: v.viewsCount ?? 0,
    likesCount: v.likesCount ?? 0,
    dislikesCount: v.dislikesCount ?? 0,
    categoryId: v.categoryId ?? null,
    version: v.version,
    createdAt: isoOf(v.createdAt),
    updatedAt: isoOf(v.updatedAt),
    readyAt: v.readyAt ? isoOf(v.readyAt) : undefined,
  };
}

export function toVideoDetailView(
  video: VideoRecord,
  videoRenditions: RenditionRecord[],
  cdn: CdnBase,
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
    playlistUrl: r.playlistKey ? cdnUrl(cdn, r.playlistKey) : undefined,
  }));

  return {
    id: video.id,
    ownerId: video.ownerId,
    title: video.title,
    description: video.description,
    visibility: video.visibility as VideoVisibility,
    status: video.status,
    progress: { overall, byRendition },
    durationMs: video.durationMs ?? undefined,
    width: video.width ?? undefined,
    height: video.height ?? undefined,
    fps: video.fps ?? undefined,
    ladder: (video.ladder as VideoDetailView['ladder']) ?? undefined,
    renditions,
    playbackUrl: playbackUrl(video, cdn),
    posterUrl: video.posterKey ? cdnUrl(cdn, video.posterKey) : undefined,
    spriteUrl: video.spriteKey ? cdnUrl(cdn, video.spriteKey) : undefined,
    spriteVttUrl: video.spriteKey
      ? cdnUrl(cdn, video.spriteKey.replace(/\.[^.]+$/, '.vtt'))
      : undefined,
    likesCount: video.likesCount ?? 0,
    dislikesCount: video.dislikesCount ?? 0,
    error: video.errorCode
      ? { code: video.errorCode, message: video.errorMessage || '' }
      : undefined,
    version: video.version,
    createdAt: isoOf(video.createdAt),
    updatedAt: isoOf(video.updatedAt),
    readyAt: video.readyAt ? isoOf(video.readyAt) : undefined,
  };
}
