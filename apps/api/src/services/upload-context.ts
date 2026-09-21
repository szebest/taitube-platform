import type {
  AuthorizationPort,
  EventRepository,
  JobQueue,
  MultipartStorage,
  StorageClient,
  UploadRecord,
  UploadRepository,
  UserRepository,
  VideoRecord,
  VideoRepository,
} from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { type UserContext, canAccessUpload, parseRole } from '@vp/permissions';
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
  const record = await ctx.uploads.findWithVideo(uploadId);
  if (!record) {
    throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Upload ${uploadId} not found`);
  }

  const userContext: UserContext = { id: user.id, role: parseRole(user.role) };
  ctx.auth.assertCan(
    canAccessUpload,
    {
      user: userContext,
      upload: { ownerId: record.video.ownerId },
      video: { ownerId: record.video.ownerId },
    },
    {
      action: 'access',
      subject: 'Upload',
      user: userContext,
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
