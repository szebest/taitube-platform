import type { UploadResource, VideoResource } from '../types/index.js';

/**
 * Normalizes upload-like inputs into a canonical UploadResource.
 * Resolves ownerId from upload.ownerId, upload.userId, video.ownerId, or video.userId.
 */
export function normalizeUploadResource(
  upload?: Partial<UploadResource> | null,
  video?: Partial<VideoResource> | null
): UploadResource | undefined {
  if (!(upload || video)) return undefined;

  const ownerId = upload?.ownerId ?? upload?.userId ?? video?.ownerId ?? video?.userId;

  return {
    ...upload,
    ...(ownerId !== undefined ? { ownerId } : {}),
  };
}
