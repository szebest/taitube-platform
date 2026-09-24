import { inProcessAppConfig } from '@vp/env-schema';
import { mintToken } from '@vp/dev-token';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../../app';

describe('dev JWKS route', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = (await composeApp({ config: inProcessAppConfig() })).app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Ed25519 dev key set anonymously', async () => {
    const res = await app.inject({ method: 'GET', url: '/.well-known/jwks.json' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json().keys).toEqual([expect.objectContaining({ kty: 'OKP', crv: 'Ed25519' })]);
  });

  it('publishes the key a minted dev token names', async () => {
    const [header] = mintToken({ sub: '00000000-0000-7000-8000-000000000001' }).split('.');
    const { kid } = JSON.parse(Buffer.from(header ?? '', 'base64url').toString('utf8'));

    const res = await app.inject({ method: 'GET', url: '/.well-known/jwks.json' });

    expect(res.json().keys.map((key: { kid: string }) => key.kid)).toContain(kid);
  });
});
