import type { VideoRecord } from './video-repository.js';

export interface UploadRecord {
  id: string;
  videoId: string;
  strategy: 'single' | 'multipart';
  status: 'OPEN' | 'COMPLETED' | 'ABORTED' | 'EXPIRED';
  partSizeBytes: number | null;
  partsExpected: number | null;
  declaredSizeBytes: number;
  declaredContentType: string;
  sha256: string | null;
  multipartUploadId: string | null;
  expiresAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

export interface NewUploadInput {
  id: string;
  videoId: string;
  strategy: 'single' | 'multipart';
  status?: 'OPEN' | 'COMPLETED' | 'ABORTED' | 'EXPIRED';
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
  abstract updateStatus(uploadId: string, status: string): Promise<UploadRecord | null>;
}
