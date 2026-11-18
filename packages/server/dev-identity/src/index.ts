import {
  DEV_PERSONAS,
  type DevTokenConfig,
  getDevJwks as jwksFor,
  type MintTokenOptions,
  mintToken as mintFor,
  type TokenPayload,
  type VerifyTokenOptions,
  verifyToken as verifyFor,
} from '@kit/dev-token';

export { DEV_PERSONAS };

/**
 * This repository's dev identity provider: the values every dev token, JWKS and verifier here agree on.
 * @public
 */
export const DEV_TOKEN_CONFIG: DevTokenConfig = {
  product: 'video-pipeline',
  issuer: 'vp-dev',
  audience: 'vp-api',
  keyId: 'vp-dev-key-1',
  seed: 'video-pipeline-dev-token-seed-ed25519-v1',
  routes: { jwks: ['/.well-known/jwks.json', '/jwks.json'], token: '/token' },
};

export const mintToken = (options?: MintTokenOptions): string => mintFor(DEV_TOKEN_CONFIG, options);

/** @public */
export const verifyToken = (token: string, options?: VerifyTokenOptions): TokenPayload =>
  verifyFor(DEV_TOKEN_CONFIG, token, options);

export const getDevJwks = () => jwksFor(DEV_TOKEN_CONFIG);
