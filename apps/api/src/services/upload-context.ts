import type { AuthorizationPort, JobQueue, MultipartStorage, StorageClient } from '@vp/core/ports';
import type {
  EventRepository,
  UploadRecord,
  UploadRepository,
  UserRepository,
  VideoRecord,
  VideoRepository,
} from '@vp/core/repositories';
import { ErrorCodes, PermanentError, toPipelineError } from '@vp/errors';
import { canAccessUpload } from '@vp/permissions';
import { isErr } from '@vp/result';
import type { AuthUser } from '../plugins/auth';

export interface UploadContext {
  uploads: UploadRepository;
  videos: VideoRepository;
  events: EventRepository;
  users?: UserRepository;
  storage: StorageClient;
  multipart: MultipartStorage;
  rawBucket: string;
  probeQueue?: JobQueue;
  multipartThresholdBytes: number;
  presignedUrlTtlSeconds: number;
  maxInflightPerUser: number;
  auth: AuthorizationPort;
}

/**
 * Every upload use case past initiation starts the same way: find the upload
 * with its video, or refuse. Ownership is asserted before the caller learns
 * whether the upload exists.
 */
export async function loadOwnedUpload(
  ctx: UploadContext,
  user: AuthUser,
  uploadId: string,
  action: string
): Promise<{ upload: UploadRecord; video: VideoRecord }> {
  const found = await ctx.uploads.findWithVideo(uploadId);
  if (isErr(found)) throw toPipelineError(found.error);

  const record = found.value;
  if (record === null) {
    throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Upload ${uploadId} not found`);
  }

  ctx.auth.assertCan(
    canAccessUpload,
    {
      user: user,
      upload: { ownerId: record.video.ownerId },
      video: { ownerId: record.video.ownerId },
    },
    {
      action: 'access',
      subject: 'Upload',
      user: user,
      message: `Not authorized to ${action}`,
    }
  );

  return record;
}

export function assertUploadOpen(upload: UploadRecord): void {
  if (upload.status !== 'OPEN') {
    throw new PermanentError(
      ErrorCodes.UPLOAD_NOT_OPEN,
      `Upload is not open (current status: ${upload.status})`
    );
  }
}
