import type { NewUploadInput } from '@vp/core/ports';
import { toUploadInsert, toUploadStatusUpdate } from '../upload.mapper';

describe('adapters/postgres/mappers: upload', () => {
  const input: NewUploadInput = {
    id: 'upl-1',
    videoId: 'vid-1',
    strategy: 'multipart',
    declaredSizeBytes: 1024,
    declaredContentType: 'video/mp4',
    expiresAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('defaults status to OPEN and nulls the optional columns', () => {
    expect(toUploadInsert(input)).toMatchObject({
      status: 'OPEN',
      partSizeBytes: null,
      partsExpected: null,
      sha256: null,
      multipartUploadId: null,
    });
  });

  it('keeps a supplied status', () => {
    expect(toUploadInsert({ ...input, status: 'ABORTED' }).status).toBe('ABORTED');
  });

  it('stamps completedAt only when completing', () => {
    expect(toUploadStatusUpdate('COMPLETED').completedAt).toBeInstanceOf(Date);
  });

  it.each([{ status: 'OPEN' as const }, { status: 'ABORTED' as const }])(
    'leaves completedAt untouched for $status',
    ({ status }) => {
      expect(toUploadStatusUpdate(status)).not.toHaveProperty('completedAt');
    }
  );
});
