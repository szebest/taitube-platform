import * as crypto from 'node:crypto';
import type { DevTokenConfig } from './config';

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

function isOkpJwk(
  jwk: crypto.JsonWebKey
): jwk is crypto.JsonWebKey & { kty: string; crv: string; x: string } {
  return typeof jwk.kty === 'string' && typeof jwk.crv === 'string' && typeof jwk.x === 'string';
}

export function getDevKeyPair(
  config: Pick<DevTokenConfig, 'keyId' | 'seed'>,
  seedText: string = config.seed
): KeyPairResult {
  const seed = crypto.createHash('sha256').update(seedText).digest();

  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_DER_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });

  const publicKey = crypto.createPublicKey(privateKey);
  const exportedJwk = publicKey.export({ format: 'jwk' });
  if (!isOkpJwk(exportedJwk)) {
    throw new TypeError('an Ed25519 public key exports as an OKP JWK');
  }

  const jwk: DevJwk = { ...exportedJwk, alg: 'EdDSA', use: 'sig', kid: config.keyId };

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

export function getDevJwks(
  config: Pick<DevTokenConfig, 'keyId' | 'seed'>,
  seedText?: string
): DevJwks {
  return getDevKeyPair(config, seedText).jwks;
}
