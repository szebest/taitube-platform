import type { NewUploadInput, UploadStatus } from '@vp/core/repositories';
import type { uploads } from '@vp/db';

type UploadInsert = typeof uploads.$inferInsert;

export function toUploadInsert(data: NewUploadInput): UploadInsert {
  return {
    id: data.id,
    videoId: data.videoId,
    strategy: data.strategy,
    status: data.status ?? 'OPEN',
    partSizeBytes: data.partSizeBytes ?? null,
    partsExpected: data.partsExpected ?? null,
    declaredSizeBytes: data.declaredSizeBytes,
    declaredContentType: data.declaredContentType,
    sha256: data.sha256 ?? null,
    multipartUploadId: data.multipartUploadId ?? null,
    expiresAt: data.expiresAt,
  };
}

export function toUploadStatusUpdate(status: UploadStatus): Partial<UploadInsert> {
  return {
    status,
    ...(status === 'COMPLETED' && { completedAt: new Date() }),
  };
}
