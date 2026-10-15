import * as crypto from 'node:crypto';

interface DevJwk extends crypto.JsonWebKey {
  kty: string;
  crv: string;
  alg: string;
  use: string;
  kid: string;
  x: string;
}

export interface DevJwks {
  keys: DevJwk[];
}

export interface KeyPairResult {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  jwk: DevJwk;
  jwks: DevJwks;
}

const ED25519_PKCS8_DER_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const DEFAULT_DEV_SEED = 'video-pipeline-dev-token-seed-ed25519-v1';
export const DEV_KEY_ID = 'vp-dev-key-1';

export function getDevKeyPair(seedText: string = DEFAULT_DEV_SEED): KeyPairResult {
  const seed = crypto.createHash('sha256').update(seedText).digest();

  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_DER_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });

  const publicKey = crypto.createPublicKey(privateKey);
  const exportedJwk = publicKey.export({ format: 'jwk' }) as {
    kty: string;
    crv: string;
    x: string;
  };

  const jwk: DevJwk = { ...exportedJwk, alg: 'EdDSA', use: 'sig', kid: DEV_KEY_ID };

  const jwks: DevJwks = {
    keys: [jwk],
  };

  return {
    privateKey,
    publicKey,
    jwk,
    jwks,
  };
}

export function getDevJwks(seedText?: string): DevJwks {
  return getDevKeyPair(seedText).jwks;
}
