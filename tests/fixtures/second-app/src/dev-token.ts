import type { DevTokenConfig } from '@kit/dev-token';

export const shopDevToken = (now: () => number): DevTokenConfig => ({
  product: 'quill',
  issuer: 'quill-local',
  audience: 'quill-shop',
  keyId: 'quill-key-1',
  seed: 'quill-seed',
  routes: { jwks: ['/keys.json'], token: '/sign-in' },
  now,
});
