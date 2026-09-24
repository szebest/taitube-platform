import * as crypto from 'node:crypto';
import { DEV_KEY_ID, getDevJwks, getDevKeyPair } from '../keys';

describe('dev-token: keys', () => {
  it('publishes one Ed25519 signing key under the dev key id', () => {
    const { keys } = getDevJwks();

    expect(keys).toEqual([
      {
        kty: 'OKP',
        crv: 'Ed25519',
        alg: 'EdDSA',
        use: 'sig',
        kid: DEV_KEY_ID,
        x: expect.any(String),
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
