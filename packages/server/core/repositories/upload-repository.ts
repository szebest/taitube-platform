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
  abstract findById(id: string): Promise<UploadRecord | null>;
  abstract findByVideoId(videoId: string): Promise<UploadRecord | null>;
  abstract findWithVideo(uploadId: string): Promise<UploadWithVideo | null>;
  abstract create(data: NewUploadInput): Promise<UploadRecord>;
  abstract updateStatus(uploadId: string, status: UploadStatus): Promise<UploadRecord | null>;
}
