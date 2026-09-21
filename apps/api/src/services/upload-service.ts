import { CaslAuthorizationAdapter } from '@vp/adapters';
import type {
  AuthorizationPort,
  JobQueue,
  MultipartStorage,
  StorageClient,
  StoragePresignedPartInfo,
} from '@vp/core/ports';
import type {
  EventRepository,
  UploadRepository,
  UserRepository,
  VideoRepository,
} from '@vp/core/repositories';
import { MULTIPART_THRESHOLD_BYTES } from '@vp/storage';
import type { AuthUser } from '../plugins/auth';
import { abortUpload } from './upload-abort';
import {
  type CompleteUploadOptions,
  type CompleteUploadResult,
  type UploadPart,
  completeUpload,
} from './upload-complete';
import type { UploadContext } from './upload-context';
import {
  type InitiateUploadParams,
  type InitiateUploadResult,
  initiateUpload,
} from './upload-initiate';
import { type UploadResumeInfo, getUploadResumeInfo, issueUploadPartUrls } from './upload-parts';

export * from './upload-complete';
export * from './upload-context';
export * from './upload-initiate';
export * from './upload-parts';

const DEFAULT_PRESIGNED_TTL_SECONDS = 15 * 60;
const DEFAULT_MAX_INFLIGHT_PER_USER = 3;

export interface UploadServiceDeps {
  uploads: UploadRepository;
  videos: VideoRepository;
  events: EventRepository;
  users?: UserRepository;
  storage: StorageClient;
  multipart: MultipartStorage;
  rawBucket?: string;
  probeQueue?: JobQueue;
  multipartThresholdBytes?: number;
  presignedUrlTtlSeconds?: number;
  maxInflightPerUser?: number;
  authorization?: AuthorizationPort;
}

/**
 * UploadService — the upload lifecycle (SDD §3.1, §6.1). Each use case lives in
 * its own module beside this one; the class is the seam routes depend on and the
 * owner of the shared collaborator set.
 */
export class UploadService {
  private readonly ctx: UploadContext;

  constructor(deps: UploadServiceDeps) {
    this.ctx = {
      uploads: deps.uploads,
      videos: deps.videos,
      events: deps.events,
      ...(deps.users ? { users: deps.users } : {}),
      storage: deps.storage,
      multipart: deps.multipart,
      rawBucket: deps.rawBucket || process.env['STORAGE_RAW_BUCKET'] || 'raw',
      ...(deps.probeQueue ? { probeQueue: deps.probeQueue } : {}),
      multipartThresholdBytes: deps.multipartThresholdBytes ?? MULTIPART_THRESHOLD_BYTES,
      presignedUrlTtlSeconds: deps.presignedUrlTtlSeconds ?? DEFAULT_PRESIGNED_TTL_SECONDS,
      maxInflightPerUser:
        deps.maxInflightPerUser ??
        (process.env['MAX_INFLIGHT_PER_USER']
          ? Number.parseInt(process.env['MAX_INFLIGHT_PER_USER'], 10)
          : DEFAULT_MAX_INFLIGHT_PER_USER),
      auth: deps.authorization ?? new CaslAuthorizationAdapter(),
    };
  }

  initiate(user: AuthUser, params: InitiateUploadParams): Promise<InitiateUploadResult> {
    return initiateUpload(this.ctx, user, params);
  }

  getResumeInfo(user: AuthUser, uploadId: string): Promise<UploadResumeInfo> {
    return getUploadResumeInfo(this.ctx, user, uploadId);
  }

  issuePartUrls(
    user: AuthUser,
    uploadId: string,
    from: number,
    count: number
  ): Promise<StoragePresignedPartInfo[]> {
    return issueUploadPartUrls(this.ctx, user, uploadId, from, count);
  }

  complete(
    user: AuthUser,
    uploadId: string,
    parts?: UploadPart[],
    options?: CompleteUploadOptions
  ): Promise<CompleteUploadResult> {
    return completeUpload(this.ctx, user, uploadId, parts, options);
  }

  abort(user: AuthUser, uploadId: string): Promise<void> {
    return abortUpload(this.ctx, user, uploadId);
  }
}
