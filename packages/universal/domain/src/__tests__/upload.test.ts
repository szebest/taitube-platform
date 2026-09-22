import type { Upload, UploadStrategy } from '../upload';

describe('@vp/domain: the upload entity', () => {
  it('requires every column, because an upload row is never partially known', () => {
    const upload: Upload = {
      id: 'upload-1',
      videoId: 'video-1',
      strategy: 'single',
      status: 'OPEN',
      partSizeBytes: null,
      partsExpected: null,
      declaredSizeBytes: 1_000,
      declaredContentType: 'video/mp4',
      sha256: null,
      multipartUploadId: null,
      expiresAt: new Date(0),
      completedAt: null,
      createdAt: new Date(0),
    };

    expect(Object.keys(upload).sort()).toEqual([
      'completedAt',
      'createdAt',
      'declaredContentType',
      'declaredSizeBytes',
      'expiresAt',
      'id',
      'multipartUploadId',
      'partSizeBytes',
      'partsExpected',
      'sha256',
      'status',
      'strategy',
      'videoId',
    ]);
  });

  it('admits exactly two strategies', () => {
    const strategies: UploadStrategy[] = ['single', 'multipart'];

    expect(strategies).toHaveLength(2);
  });
});
