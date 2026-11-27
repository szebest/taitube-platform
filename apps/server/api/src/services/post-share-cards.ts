import { type Result, assertNever, isOk, map, ok } from '@kit/result';
import type { PlaylistRepositoryPort, VideoRepository } from '@vp/core/repositories';
import type { PlaylistDetail, PostPayload, PostShareCard, Video } from '@vp/domain';
import { type SharedTarget, decidePostShare } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable } from '@vp/errors';
import { thumbnailUrl } from './video-views';

export interface PostShareDeps {
  videos: Pick<VideoRepository, 'findById'>;
  playlists: Pick<PlaylistRepositoryPort, 'findDetail'>;
  cdn: CdnBase;
}

export type ShareSource =
  | { type: 'video'; video: Video }
  | { type: 'playlist'; detail: PlaylistDetail };

export type ShareRef = { type: 'video' | 'playlist'; id: string };

export function shareRefOf(payload: PostPayload): ShareRef | null {
  switch (payload.kind) {
    case 'text':
    case 'images':
      return null;
    case 'video_share':
      return { type: 'video', id: payload.videoId };
    case 'playlist_share':
      return { type: 'playlist', id: payload.playlistId };
    default:
      return assertNever(payload, 'PostPayload');
  }
}

/** A playlist is read as an anonymous visitor reads it, so a private one is absent and an unlisted one is not public. */
export async function loadShareSource(
  { videos, playlists }: PostShareDeps,
  ref: ShareRef
): Promise<Result<ShareSource | null, DatabaseUnavailable>> {
  switch (ref.type) {
    case 'video':
      return map(await videos.findById(ref.id), (video) => video && { type: 'video', video });
    case 'playlist':
      return map(
        await playlists.findDetail(ref.id, null),
        (detail) => detail && { type: 'playlist', detail }
      );
    default:
      return assertNever(ref.type, 'ShareRef');
  }
}

export function sharedTargetOf(source: ShareSource | null): SharedTarget | null {
  if (!source) return null;
  switch (source.type) {
    case 'video': {
      const { id, visibility, status } = source.video;
      return { type: 'video', id, visibility, status };
    }
    case 'playlist': {
      const { id, visibility } = source.detail.playlist;
      return { type: 'playlist', id, visibility };
    }
    default:
      return assertNever(source, 'ShareSource');
  }
}

export async function loadSharedTarget(
  deps: PostShareDeps,
  payload: PostPayload
): Promise<Result<SharedTarget | null, DatabaseUnavailable>> {
  const ref = shareRefOf(payload);
  if (!ref) return ok(null);
  return map(await loadShareSource(deps, ref), sharedTargetOf);
}

const UNAVAILABLE: PostShareCard = { type: 'unavailable' };

/** What the card shows is decided by the rule that admitted the share, so the two cannot disagree. */
export function shareCardOf(
  payload: PostPayload,
  source: ShareSource | null,
  cdn: CdnBase
): PostShareCard {
  const shared = sharedTargetOf(source);
  if (!source || !isOk(decidePostShare({ payload, shared }))) return UNAVAILABLE;
  switch (source.type) {
    case 'video': {
      const { id, title, durationMs } = source.video;
      return {
        type: 'video',
        id,
        title: title ?? '',
        thumbnailUrl: thumbnailUrl(source.video, cdn) ?? null,
        durationSeconds: durationMs === null ? null : Math.round(durationMs / 1000),
      };
    }
    case 'playlist': {
      const { id, title } = source.detail.playlist;
      return { type: 'playlist', id, title, itemCount: source.detail.items.length };
    }
    default:
      return assertNever(source, 'ShareSource');
  }
}
