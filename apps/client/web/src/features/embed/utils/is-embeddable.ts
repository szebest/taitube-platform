import type { Video } from '@vp/api-contracts';

const PLAYABLE = {
  UPLOADING: false,
  UPLOADED: false,
  PROBING: false,
  PROCESSING: false,
  READY: true,
  FAILED: false,
  REJECTED: false,
  ABANDONED: false,
  DELETED: false,
  LIVE: false,
  HELD: false,
} as const satisfies Record<Video['status'], boolean>;

/** A ready video that is public, or that this request may read anyway: through a share link, or unlocked by its password. */
export function isEmbeddable(video: Video): boolean {
  return (
    PLAYABLE[video.status] &&
    (video.visibility === 'public' || video.shareLinkId !== undefined || video.passwordProtected)
  );
}
