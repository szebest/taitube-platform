import cors from '@fastify/cors';
import fastify from 'fastify';
import { corsOptionsFor } from '../cors';

const ORIGIN = 'http://localhost:5173';

async function appWith() {
  const app = fastify({ logger: false });
  await app.register(cors, { delegator: corsOptionsFor([ORIGIN]) });
  app.get('/v1/thing', async () => ({ ok: true }));
  return app;
}

describe('apps/server/api/plugins: cors', () => {
  it.each([
    { scenario: 'a session bearer', authorization: 'Bearer eyJ.e30.sig', allowed: ORIGIN },
    { scenario: 'no credential', authorization: undefined, allowed: ORIGIN },
    {
      scenario: 'a personal access token',
      authorization: 'Bearer tt_pat_0a1b2c3d_ff',
      allowed: undefined,
    },
  ])('answers a listed origin with $scenario: $allowed', async ({ authorization, allowed }) => {
    const app = await appWith();

    const res = await app.inject({
      url: '/v1/thing',
      headers: { origin: ORIGIN, ...(authorization && { authorization }) },
    });

    expect(res.headers['access-control-allow-origin']).toBe(allowed);
    await app.close();
  });

  it('caches a preflight for two hours and allows the write methods', async () => {
    const app = await appWith();

    const res = await app.inject({
      method: 'OPTIONS',
      url: '/v1/thing',
      headers: { origin: ORIGIN, 'access-control-request-method': 'PATCH' },
    });

    expect(res.headers).toMatchObject({
      'access-control-allow-origin': ORIGIN,
      'access-control-max-age': '7200',
      'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE',
    });
    await app.close();
  });
});
