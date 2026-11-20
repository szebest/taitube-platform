import type { UploadResource, VideoResource } from '../types/index';

/**
 * Normalizes upload-like inputs into a canonical UploadResource.
 * Resolves ownerId from upload.ownerId, upload.userId, video.ownerId, or video.userId, and channelId from upload or video.
 */
export function normalizeUploadResource(
  upload?: Partial<UploadResource> | null,
  video?: Partial<VideoResource> | null
): UploadResource | undefined {
  if (!(upload || video)) return undefined;

  const ownerId = upload?.ownerId ?? upload?.userId ?? video?.ownerId ?? video?.userId;

  const channelId = upload?.channelId ?? video?.channelId;

  return {
    ...upload,
    ...(ownerId !== undefined ? { ownerId } : {}),
    ...(channelId !== undefined ? { channelId } : {}),
  };
}
