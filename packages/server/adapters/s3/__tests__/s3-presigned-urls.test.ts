import { expectOk } from '@vp/testing/result';
import { S3StorageClient } from '../s3-storage-client';

const BUCKET = 'raw';
const KEY = '018f0000-0000-7000-8000-000000000001/source.mp4';

function localClient(): S3StorageClient {
  return new S3StorageClient({
    type: 'connection',
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  });
}

describe('S3StorageClient presigned urls', () => {
  it('signs a PUT carrying the declared content headers and a 15 minute expiry', async () => {
    const presigned = expectOk(
      await localClient().createPresignedPutUrl({
        bucket: BUCKET,
        key: KEY,
        contentType: 'video/mp4',
        contentLength: 1048576,
        expiresInSeconds: 900,
      })
    );

    expect(presigned.url).toContain(`http://localhost:9000/${BUCKET}/`);
    expect(presigned.url).toContain('X-Amz-Signature');
    expect(presigned.url).toContain('X-Amz-Expires=900');
    expect(presigned.headers['content-type']).toBe('video/mp4');
    expect(presigned.headers['content-length']).toBe('1048576');

    const ttlMs = presigned.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(14 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(15 * 60 * 1000 + 2000);
  });

  it('signs the PUT for the expiry it is handed and reports a zero content length', async () => {
    const presigned = expectOk(
      await localClient().createPresignedPutUrl({
        bucket: BUCKET,
        key: KEY,
        contentType: 'video/mp4',
        contentLength: 0,
        expiresInSeconds: 900,
      })
    );

    expect(presigned.url).toContain('X-Amz-Expires=900');
    expect(presigned.headers['content-length']).toBe('0');
  });

  it('signs a GET', async () => {
    const url = expectOk(
      await localClient().createPresignedGetUrl({
        bucket: BUCKET,
        key: KEY,
        expiresInSeconds: 60,
      })
    );

    expect(url).toContain(`http://localhost:9000/${BUCKET}/`);
    expect(url).toContain('X-Amz-Expires=60');
  });
});
