import { type Result, err, isErr, map, ok } from '@kit/result';
import type { JobQueue, MultipartStorage, StorageClient } from '@vp/core/ports';
import type {
  ChannelAuditRepositoryPort,
  EventRepository,
  UploadRecord,
  UploadRepository,
  UserRepository,
  VideoRecord,
  VideoRepository,
} from '@vp/core/repositories';
import {
  type UploadAccessFailure,
  type UploadNotOpen,
  decideUploadAccess,
  uploadNotOpen,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';

export interface UploadContext {
  uploads: UploadRepository;
  videos: VideoRepository;
  events: EventRepository;
  audit: Pick<ChannelAuditRepositoryPort, 'append'>;
  users: UserRepository;
  storage: StorageClient;
  multipart: MultipartStorage;
  rawBucket: string;
  probeQueue: JobQueue;
  multipartThresholdBytes: number;
  partSizeMinBytes: number;
  partSizeMaxBytes: number;
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
    upload: record
      ? { id: record.upload.id, ownerId: record.video.ownerId, channelId: record.video.channelId }
      : null,
    uploadId,
    action,
  });

  return map(decided, () => record as OwnedUpload);
}

/**
 * Closes an open upload. A close another request landed first refuses this one, so a completion
 * and an abort that race cannot both win.
 */
export async function closeUpload(
  ctx: Pick<UploadContext, 'uploads'>,
  uploadId: string,
  status: 'COMPLETED' | 'ABORTED'
): Promise<Result<UploadRecord, UploadNotOpen | DatabaseUnavailable>> {
  const closed = await ctx.uploads.updateStatus(uploadId, status);
  if (isErr(closed)) return closed;
  if (closed.value) return ok(closed.value);

  const current = await ctx.uploads.findById(uploadId);
  if (isErr(current)) return current;
  return err(uploadNotOpen(uploadId, current.value?.status ?? 'MISSING'));
}
