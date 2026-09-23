import { withEnv } from '@vp/testing';
import { isNotFound, s3ClientFrom } from '../s3-config';

describe('s3 adapter: connection config', () => {
  it('prefers the explicit config over the environment', async () => {
    await withEnv({ S3_ENDPOINT: 'http://from-env:9000' }, async () => {
      const client = s3ClientFrom({ endpoint: 'http://explicit:9000', region: 'eu-west-1' });

      expect(await client.config.region()).toBe('eu-west-1');
    });
  });

  it.each([
    { scenario: 'a localhost endpoint', endpoint: 'http://localhost:9000', expected: true },
    { scenario: 'a minio endpoint', endpoint: 'http://minio:9000', expected: true },
    { scenario: 'a loopback endpoint', endpoint: 'http://127.0.0.1:9000', expected: true },
    {
      scenario: 'a cloud endpoint',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      expected: false,
    },
  ])('forces path style for $scenario', async ({ endpoint, expected }) => {
    await withEnv(
      { S3_FORCE_PATH_STYLE: undefined, STORAGE_FORCE_PATH_STYLE: undefined },
      async () => {
        const client = s3ClientFrom({ endpoint });

        expect(client.config.forcePathStyle).toBe(expected);
      }
    );
  });

  it.each([
    {
      scenario: 'a NotFound exception',
      cause: Object.assign(new Error('x'), { name: 'NotFound' }),
    },
    {
      scenario: 'a NoSuchKey exception',
      cause: Object.assign(new Error('x'), { name: 'NoSuchKey' }),
    },
    { scenario: 'a bare 404', cause: { $metadata: { httpStatusCode: 404 } } },
  ])('reads $scenario as absence', ({ cause }) => {
    expect(isNotFound(cause)).toBe(true);
  });

  it.each([
    {
      scenario: 'a permission error',
      cause: Object.assign(new Error('x'), { name: 'AccessDenied' }),
    },
    { scenario: 'a 500', cause: { $metadata: { httpStatusCode: 500 } } },
  ])('does not read $scenario as absence', ({ cause }) => {
    expect(isNotFound(cause)).toBe(false);
  });
});
