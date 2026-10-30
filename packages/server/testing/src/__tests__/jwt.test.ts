import * as crypto from 'node:crypto';
import { type SigningAlgorithm, signJwt, signingKey } from '../jwt';

const DIGESTS: Record<SigningAlgorithm, string | null> = {
  RS256: 'sha256',
  ES256: 'sha256',
  EdDSA: null,
};

describe('packages/testing: signJwt', () => {
  it.each(['RS256', 'ES256', 'EdDSA'] as const)(
    'signs a %s token its public JWK verifies',
    (alg) => {
      const key = signingKey(alg, `${alg}-key`);
      const [header, payload, signature] = signJwt(key, { sub: 'someone' }).split('.') as [
        string,
        string,
        string,
      ];

      const verified = crypto.verify(
        DIGESTS[alg],
        Buffer.from(`${header}.${payload}`),
        { key: crypto.createPublicKey({ key: key.jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64url')
      );

      expect(verified).toBe(true);
      expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
        alg,
        typ: 'JWT',
        kid: `${alg}-key`,
      });
    }
  );

  it('lets the header say something the key does not', () => {
    const [header] = signJwt(signingKey('RS256', 'k'), {}, { alg: 'none', kid: undefined }).split(
      '.'
    );

    expect(JSON.parse(Buffer.from(header ?? '', 'base64url').toString())).toEqual({
      alg: 'none',
      typ: 'JWT',
    });
  });
});
