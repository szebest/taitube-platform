import * as crypto from 'node:crypto';
import { mintToken, parseTtlSeconds, verifyToken } from '../jwt';
import { getDevJwks } from '../keys';

describe('dev-token: EdDSA JWT mint and verify', () => {
  const testSub = '11111111-2222-3333-4444-555555555555';

  it('mints JWT with sub, role admin, ttl 8h and iss=vp-dev, aud=vp-api', () => {
    const token = mintToken({
      sub: testSub,
      role: 'admin',
      ttl: '8h',
    });

    expect(token).toBeDefined();
    const parts = token.split('.');
    expect(parts.length).toBe(3);

    const [h, p] = parts as [string, string, string];
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf-8'));
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf-8'));

    expect(header.alg).toBe('EdDSA');
    expect(header.typ).toBe('JWT');
    expect(header.kid).toBe('vp-dev-key-1');

    expect(payload.sub).toBe(testSub);
    expect(payload.role).toBe('admin');
    expect(payload.iss).toBe('vp-dev');
    expect(payload.aud).toBe('vp-api');
    expect(payload.exp - payload.iat).toBe(8 * 3600);
  });

  it('verifies valid minted token against JWKS', () => {
    const token = mintToken({
      sub: testSub,
      role: 'admin',
      ttl: '8h',
    });

    const payload = verifyToken(token);
    expect(payload.sub).toBe(testSub);
    expect(payload.role).toBe('admin');
    expect(payload.iss).toBe('vp-dev');
    expect(payload.aud).toBe('vp-api');

    const jwks = getDevJwks();
    const key = jwks.keys[0];
    expect(key).toBeDefined();
    if (!key) return;
    expect(key.kty).toBe('OKP');
    expect(key.crv).toBe('Ed25519');
    expect(key.alg).toBe('EdDSA');

    const importedPublicKey = crypto.createPublicKey({
      key: {
        kty: key.kty,
        crv: key.crv,
        x: key.x,
      },
      format: 'jwk',
    });

    const [h, p, s] = token.split('.') as [string, string, string];
    const valid = crypto.verify(
      null,
      Buffer.from(`${h}.${p}`),
      importedPublicKey,
      Buffer.from(s, 'base64url')
    );
    expect(valid).toBe(true);
  });

  it('rejects expired token', () => {
    const expiredToken = mintToken({
      sub: testSub,
      ttl: -10,
    });

    expect(() => verifyToken(expiredToken)).toThrow(/expired/i);
  });

  it('rejects tampered token signature or payload', () => {
    const token = mintToken({ sub: testSub, role: 'user' });
    const [h, p, s] = token.split('.') as [string, string, string];

    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf-8'));
    payload.role = 'admin';
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedToken = `${h}.${tamperedPayload}.${s}`;

    expect(() => verifyToken(tamperedToken)).toThrow(/signature/i);
  });

  it.each([
    ['30s', 30],
    ['15m', 900],
    ['8h', 28800],
    ['1d', 86400],
    [3600, 3600],
    [undefined, 28800],
  ])('parses the TTL %j as %i seconds', (ttl, seconds) => {
    expect(parseTtlSeconds(ttl)).toBe(seconds);
  });

  it('rejects a malformed TTL', () => {
    expect(() => parseTtlSeconds('invalid')).toThrow(/invalid ttl/i);
  });
});
