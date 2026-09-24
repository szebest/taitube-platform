import { SECRET_KEYS } from '../secret-keys';

describe('packages/env-schema: SECRET_KEYS', () => {
  it('lists the credentials a production boot needs and the cloud ExternalSecret supplies', () => {
    expect(SECRET_KEYS).toEqual([
      'DATABASE_URL',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'REDIS_PASSWORD',
    ]);
  });
});
