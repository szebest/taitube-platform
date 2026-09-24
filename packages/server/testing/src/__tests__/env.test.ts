import { PRODUCTION_ENV } from '../env';

describe('packages/testing: PRODUCTION_ENV', () => {
  it('names production and verifies tokens against a JWKS', () => {
    expect(PRODUCTION_ENV).toMatchObject({ NODE_ENV: 'production', AUTH_MODE: 'jwks' });
  });
});
