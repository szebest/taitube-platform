import * as crypto from 'node:crypto';

export type SigningAlgorithm = 'RS256' | 'ES256' | 'EdDSA';

export interface SigningKey {
  alg: SigningAlgorithm;
  kid: string;
  privateKey: crypto.KeyObject;
  jwk: crypto.JsonWebKey & { kid: string; alg: string; use: string };
}

const GENERATORS: Record<SigningAlgorithm, () => crypto.KeyPairKeyObjectResult> = {
  RS256: () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }),
  ES256: () => crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }),
  EdDSA: () => crypto.generateKeyPairSync('ed25519'),
};

const DIGESTS: Record<SigningAlgorithm, string | null> = {
  RS256: 'sha256',
  ES256: 'sha256',
  EdDSA: null,
};

export function signingKey(alg: SigningAlgorithm, kid: string): SigningKey {
  const { privateKey, publicKey } = GENERATORS[alg]();
  return {
    alg,
    kid,
    privateKey,
    jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg, use: 'sig' },
  };
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Signs `claims` with `key`. `header` overrides what the header says, so a spec can lie about the
 * alg or drop the kid while the signature stays genuine.
 */
export function signJwt(
  key: SigningKey,
  claims: Record<string, unknown>,
  header: Record<string, unknown> = {}
): string {
  const input = `${encode({ alg: key.alg, typ: 'JWT', kid: key.kid, ...header })}.${encode(claims)}`;
  const signature = crypto.sign(DIGESTS[key.alg], Buffer.from(input), {
    key: key.privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${input}.${signature.toString('base64url')}`;
}
