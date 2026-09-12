import { S3MultipartStorage } from '@vp/adapters';
import { describe, expect, it } from 'vitest';
import { rawSourceKey } from '../index';

describe('packages/storage R2 Compatibility (Ticket 11: AC 22)', () => {
  const isR2Enabled = process.env.STORAGE_E2E_R2 === '1';

  it.skipIf(!isR2Enabled)(
    'AC 22: works unchanged against Cloudflare R2 when STORAGE_E2E_R2=1',
    async () => {
      // Opt-in live test against real Cloudflare R2 bucket
      const bucket = process.env.STORAGE_RAW_BUCKET || 'raw';
      const multipart = new S3MultipartStorage();

      const videoId = '00000000-0000-7000-8000-000000000099';
      const sourceKey = rawSourceKey(videoId, 'mp4');

      // 1. Create multipart upload
      const uploadId = await multipart.createMultipartUpload(bucket, sourceKey, 'video/mp4');
      expect(uploadId).toBeDefined();

      // 2. Generate presigned part URL
      const part = await multipart.createPresignedPartUrl({
        bucket,
        key: sourceKey,
        uploadId,
        partNumber: 1,
        expiresInSeconds: 900,
      });
      expect(part.url).toContain('partNumber=1');
      expect(part.url).toContain('uploadId=');

      // 3. Abort multipart upload
      await multipart.abortMultipartUpload(bucket, sourceKey, uploadId);
    }
  );
});
