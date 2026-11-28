import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { Upload, UploadStatus, UploadStrategy } from '@vp/domain';
import type { VideoRecord } from './video-repository';

export type UploadRecord = Upload;

export interface NewUploadInput {
  id: string;
  videoId: string;
  strategy: UploadStrategy;
  status?: UploadStatus;
  partSizeBytes?: number | null;
  partsExpected?: number | null;
  declaredSizeBytes: number;
  declaredContentType: string;
  sha256?: string | null;
  multipartUploadId?: string | null;
  expiresAt: Date;
}

export interface UploadWithVideo {
  upload: UploadRecord;
  video: VideoRecord;
}

export abstract class UploadRepository {
  abstract findById(id: string): Promise<Result<UploadRecord | null, DatabaseUnavailable>>;
  abstract findByVideoId(
    videoId: string
  ): Promise<Result<UploadRecord | null, DatabaseUnavailable>>;
  abstract findWithVideo(
    uploadId: string
  ): Promise<Result<UploadWithVideo | null, DatabaseUnavailable>>;
  abstract create(data: NewUploadInput): Promise<Result<UploadRecord, DatabaseUnavailable>>;
  abstract updateStatus(
    uploadId: string,
    status: UploadStatus
  ): Promise<Result<UploadRecord | null, DatabaseUnavailable>>;
}
