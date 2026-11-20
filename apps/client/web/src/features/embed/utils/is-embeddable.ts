import type { Video } from '@vp/api-contracts';

/** A ready video that is public, or that this request may read anyway: through a share link, or unlocked by its password. */
export function isEmbeddable(video: Video): boolean {
  return (
    video.status === 'READY' &&
    (video.visibility === 'public' || video.shareLinkId !== undefined || video.passwordProtected)
  );
}
