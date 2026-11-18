import { DEV_TOKEN_CONFIG, getDevJwks, mintToken, verifyToken } from '../index';

const header = (token: string): unknown =>
  JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString());

describe('@vp/dev-identity', () => {
  it('mints a token for the dev issuer, audience and key that verifies', () => {
    const token = mintToken({ sub: 'usr-1' });

    expect(header(token)).toEqual({ alg: 'EdDSA', typ: 'JWT', kid: 'vp-dev-key-1' });
    expect(verifyToken(token)).toMatchObject({ sub: 'usr-1', iss: 'vp-dev', aud: 'vp-api' });
  });

  it('publishes the dev key, byte for byte', () => {
    expect(getDevJwks().keys).toEqual([
      {
        kty: 'OKP',
        crv: 'Ed25519',
        alg: 'EdDSA',
        use: 'sig',
        kid: DEV_TOKEN_CONFIG.keyId,
        x: 'RK4aIkyx7UG377h43wCmaUcV4W8yjojQjbrjc2lPU5g',
      },
    ]);
  });
});
