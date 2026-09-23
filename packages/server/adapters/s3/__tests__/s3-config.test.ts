import { isNotFound, s3ClientFrom } from '../s3-config';

describe('s3 adapter: connection config', () => {
  it('connects to the endpoint and region it is given', async () => {
    const client = s3ClientFrom({ endpoint: 'http://explicit:9000', region: 'eu-west-1' });

    expect(await client.config.region()).toBe('eu-west-1');
  });

  it('signs with the keys it is given', async () => {
    const client = s3ClientFrom({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    });

    expect(await client.config.credentials()).toMatchObject({
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    });
  });

  it('honours an explicit path-style setting over the endpoint heuristic', () => {
    const client = s3ClientFrom({
      endpoint: 'https://account.r2.cloudflarestorage.com',
      region: 'auto',
      forcePathStyle: true,
    });

    expect(client.config.forcePathStyle).toBe(true);
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
  ])('forces path style for $scenario', ({ endpoint, expected }) => {
    expect(s3ClientFrom({ endpoint, region: 'us-east-1' }).config.forcePathStyle).toBe(expected);
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
