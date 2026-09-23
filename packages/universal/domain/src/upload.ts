import type { UploadStatus } from './status-vocabulary.js';

export type UploadStrategy = 'single' | 'multipart';

/** The canonical upload entity; `@vp/core`'s `UploadRecord` aliases it. */
export interface Upload {
  id: string;
  videoId: string;
  strategy: UploadStrategy;
  status: UploadStatus;
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
