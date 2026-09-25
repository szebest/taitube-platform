import type { NewVideoInput, VideoRecord } from '@vp/core/repositories';

/** The row Postgres would hand back for an insert of `data`, column defaults included. */
export function newVideoRecord(data: NewVideoInput, now: Date): VideoRecord {
  const status = data.status ?? 'UPLOADING';
  return {
    ...data,
    title: data.title ?? null,
    description: data.description ?? null,
    visibility: data.visibility ?? 'private',
    status,
    sourceSizeBytes: data.sourceSizeBytes ?? null,
    durationMs: data.durationMs ?? null,
    width: data.width ?? null,
    height: data.height ?? null,
    fps: data.fps ?? null,
    ladder: data.ladder ?? null,
    masterPlaylistKey: data.masterPlaylistKey ?? null,
    posterKey: data.posterKey ?? null,
    spriteKey: data.spriteKey ?? null,
    playbackUrl: null,
    posterUrl: null,
    spriteUrl: null,
    spriteVttUrl: null,
    errorCode: data.errorCode ?? null,
    errorMessage: data.errorMessage ?? null,
    viewsCount: data.viewsCount ?? 0,
    commentsCount: 0,
    likesCount: data.likesCount ?? 0,
    dislikesCount: data.dislikesCount ?? 0,
    categoryId: data.categoryId ?? null,
    generation: data.generation ?? 1,
    version: 1,
    createdAt: now,
    updatedAt: now,
    readyAt: data.readyAt ?? (status === 'READY' ? now : null),
    deletedAt: data.deletedAt ?? null,
  };
}
