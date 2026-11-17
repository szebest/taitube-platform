import type { DevTokenConfig } from '../config';

export const TEST_CONFIG: DevTokenConfig = {
  product: 'acme',
  issuer: 'acme-dev',
  audience: 'acme-api',
  keyId: 'acme-key-1',
  seed: 'acme-test-seed',
  routes: { jwks: ['/keys.json', '/jwks'], token: '/mint' },
};
