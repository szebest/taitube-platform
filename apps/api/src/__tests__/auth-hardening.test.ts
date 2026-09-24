import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadEnv } from '@vp/config';
import { mintToken } from '@vp/dev-token';
import { toAppConfig } from '@vp/env-schema';
import { PRODUCTION_ENV } from '@vp/testing/env';
import { signJwt, signingKey } from '@vp/testing/jwt';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';

const ADMIN_ID = '00000000-0000-7000-8000-0000000000c1';

const rsa = signingKey('RS256', 'rsa-1');
const ec = signingKey('ES256', 'ec-1');

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: ADMIN_ID,
    role: 'admin',
    iss: PRODUCTION_ENV['AUTH_ISSUER'],
    aud: PRODUCTION_ENV['AUTH_AUDIENCE'],
    exp: now + 600,
    ...overrides,
  };
}

describe('apps/api: authentication under a production configuration', () => {
  let idp: http.Server;
  let app: FastifyInstance;

  beforeAll(async () => {
    idp = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ keys: [rsa.jwk, ec.jwk] }));
    });
    await new Promise<void>((resolve) => idp.listen(0, '127.0.0.1', resolve));
    const { port } = idp.address() as AddressInfo;

    const env = loadEnv({
      ...PRODUCTION_ENV,
      ADAPTER_FAMILY: 'in-memory',
      AUTH_ALGORITHMS: 'RS256,RS512,ES256',
      AUTH_JWKS_URL: `http://127.0.0.1:${port}/.well-known/jwks.json`,
    });
    app = await buildApp({ config: toAppConfig(env) });
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => idp.close(() => resolve()));
  });

  async function dlqWith(token: string) {
    return app.inject({
      method: 'GET',
      url: '/v1/admin/dlq',
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it('does not serve the dev key set', async () => {
    expect((await app.inject({ method: 'GET', url: '/.well-known/jwks.json' })).statusCode).toBe(
      404
    );
  });

  it('refuses an admin token minted by pnpm dev-token', async () => {
    const response = await dlqWith(mintToken({ sub: ADMIN_ID, role: 'admin' }));

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  it.each([
    { scenario: 'the wrong iss', token: () => signJwt(rsa, claims({ iss: 'vp-dev' })) },
    { scenario: 'the wrong aud', token: () => signJwt(rsa, claims({ aud: 'vp-api' })) },
    { scenario: 'alg none', token: () => signJwt(rsa, claims(), { alg: 'none' }) },
    {
      scenario: 'an accepted alg the JWK does not declare',
      token: () => signJwt(rsa, claims(), { alg: 'RS512' }),
    },
    {
      scenario: 'no kid while the JWKS holds two keys',
      token: () => signJwt(rsa, claims(), { kid: undefined }),
    },
  ])('refuses a validly signed token with $scenario', async ({ token }) => {
    expect((await dlqWith(token())).statusCode).toBe(401);
  });

  it.each([rsa, ec])('admits an admin whose $alg token the JWKS verifies', async (key) => {
    expect((await dlqWith(signJwt(key, claims()))).statusCode).toBe(200);
  });

  it('refuses the x-admin-token header outright, as nothing static is an admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/dlq',
      headers: { 'x-admin-token': 'change-me-32-bytes-random' },
    });

    expect(response.statusCode).toBe(401);
  });
});
