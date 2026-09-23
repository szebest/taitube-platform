import type { JobQueue, MultipartStorage, StorageClient } from '@vp/core/ports';
import type {
  EventRepository,
  UploadRecord,
  UploadRepository,
  UserRepository,
  VideoRecord,
  VideoRepository,
} from '@vp/core/repositories';
import { type UploadAccessFailure, decideUploadAccess } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, map } from '@vp/result';

export interface UploadContext {
  uploads: UploadRepository;
  videos: VideoRepository;
  events: EventRepository;
  users: UserRepository;
  storage: StorageClient;
  multipart: MultipartStorage;
  rawBucket: string;
  probeQueue: JobQueue;
  multipartThresholdBytes: number;
  presignedUrlTtlSeconds: number;
  uploadSessionTtlSeconds: number;
  maxInflightPerUser: number;
}

export interface OwnedUpload {
  upload: UploadRecord;
  video: VideoRecord;
}

export type LoadOwnedUploadFailure = UploadAccessFailure | DatabaseUnavailable;

/**
 * Every upload use case past initiation starts the same way: find the upload with its video, or
 * refuse. The refusal is a rule's verdict, returned rather than thrown.
 */
export async function loadOwnedUpload(
  ctx: UploadContext,
  user: UserContext,
  uploadId: string,
  action: string
): Promise<Result<OwnedUpload, LoadOwnedUploadFailure>> {
  const found = await ctx.uploads.findWithVideo(uploadId);
  if (isErr(found)) return found;

  const record = found.value;
  const decided = decideUploadAccess({
    actor: user,
    upload: record ? { id: record.upload.id, ownerId: record.video.ownerId } : null,
    uploadId,
    action,
  });

  return map(decided, () => record as OwnedUpload);
}
