import { heldLocalCredentials } from '../local-credentials';

describe('packages/env-schema: heldLocalCredentials', () => {
  it.each([
    'vp',
    'minioadmin',
    'admin',
    'change-me-32-bytes-random',
    'postgres://vp:vp@vp-postgres:5432/vp',
    'redis://:vp@vp-redis-master:6379/0',
    'postgres://admin:rotated@db:5432/vp',
    'https://minioadmin:minioadmin@minio:9000',
  ])('recognises %s', (value) => {
    expect(heldLocalCredentials(value)).toBe(true);
  });

  it.each([
    'a-rotated-random-value',
    'vpn',
    'postgres://app:s3cret@db:5432/vp',
    'redis://vp-redis-master:6379/0',
    'http://localhost:9000',
  ])('lets %s through', (value) => {
    expect(heldLocalCredentials(value)).toBe(false);
  });
});
