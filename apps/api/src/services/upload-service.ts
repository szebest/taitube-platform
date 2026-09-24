import type { StoragePresignedPartInfo } from '@vp/core/ports';
import type { UploadPart } from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import type { Result } from '@vp/result';
import { type AbortUploadFailure, abortUpload } from './upload-abort';
import {
  type CompleteUploadFailure,
  type CompleteUploadResult,
  completeUpload,
} from './upload-complete';
import type { UploadContext } from './upload-context';
import {
  type InitiateUploadFailure,
  type InitiateUploadParams,
  type InitiateUploadResult,
  initiateUpload,
} from './upload-initiate';
import {
  type PartUrlsFailure,
  type ResumeInfoFailure,
  type UploadResumeInfo,
  getUploadResumeInfo,
  issueUploadPartUrls,
} from './upload-parts';

export * from './upload-complete';
export * from './upload-context';
export * from './upload-initiate';
export * from './upload-parts';

/**
 * UploadService — the upload lifecycle (SDD §3.1, §6.1). Each use case lives in
 * its own module beside this one; the class is the seam routes depend on and the
 * owner of the shared collaborator set.
 */
export class UploadService {
  constructor(private readonly ctx: UploadContext) {}

  initiate(
    user: UserContext,
    params: InitiateUploadParams
  ): Promise<Result<InitiateUploadResult, InitiateUploadFailure>> {
    return initiateUpload(this.ctx, user, params);
  }

  getResumeInfo(
    user: UserContext,
    uploadId: string
  ): Promise<Result<UploadResumeInfo, ResumeInfoFailure>> {
    return getUploadResumeInfo(this.ctx, user, uploadId);
  }

  issuePartUrls(
    user: UserContext,
    uploadId: string,
    from: number,
    count: number
  ): Promise<Result<StoragePresignedPartInfo[], PartUrlsFailure>> {
    return issueUploadPartUrls(this.ctx, user, uploadId, from, count);
  }

  complete(
    user: UserContext,
    uploadId: string,
    parts?: readonly UploadPart[]
  ): Promise<Result<CompleteUploadResult, CompleteUploadFailure>> {
    return completeUpload(this.ctx, user, uploadId, parts);
  }

  abort(user: UserContext, uploadId: string): Promise<Result<void, AbortUploadFailure>> {
    return abortUpload(this.ctx, user, uploadId);
  }
}
