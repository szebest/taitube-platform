import * as crypto from 'node:crypto';
import { getDevJwks as jwks, getDevKeyPair as keyPair } from '../keys';
import { TEST_CONFIG } from './test-config';

const getDevJwks = () => jwks(TEST_CONFIG);
const getDevKeyPair = (seed?: string) => keyPair(TEST_CONFIG, seed);

describe('dev-token: keys', () => {
  it('publishes one Ed25519 signing key under the dev key id', () => {
    const { keys } = getDevJwks();

    expect(keys).toEqual([
      {
        kty: 'OKP',
        crv: 'Ed25519',
        alg: 'EdDSA',
        use: 'sig',
        kid: TEST_CONFIG.keyId,
        x: '-jYX7f-9uJyxScqozBHRIxU0wiMXooyzzojJR8eFiXc',
      },
    ]);
  });

  it('derives the same key from the same seed and another key from another seed', () => {
    const first = getDevKeyPair('seed-a').jwk.x;

    expect(getDevKeyPair('seed-a').jwk.x).toBe(first);
    expect(getDevKeyPair('seed-b').jwk.x).not.toBe(first);
  });

  it('publishes the public half of the key it signs with', () => {
    const { privateKey, jwk } = getDevKeyPair();
    const data = Buffer.from('signed by the dev key');
    const signature = crypto.sign(null, data, privateKey);
    const published = crypto.createPublicKey({
      key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x },
      format: 'jwk',
    });

    expect(crypto.verify(null, data, published, signature)).toBe(true);
  });
});
