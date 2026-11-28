import { InMemoryFixedWindowCounter, InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp } from './test-app';

const ORIGIN = 'http://localhost:5173';

describe('personal access token rate limit, end to end', () => {
  let repositories: InMemoryRepositories;
  let counter: InMemoryFixedWindowCounter;
  let apps: FastifyInstance[];
  let first: FastifyInstance;
  let headers: Record<string, string>;

  const read = (app: FastifyInstance) =>
    app.inject({ method: 'GET', url: '/v1/videos', headers: { ...headers, origin: ORIGIN } });

  async function processOver(sharedCounter: InMemoryFixedWindowCounter) {
    const { app } = await buildTestApp({
      adapters: { repositories, fixedWindowCounter: sharedCounter },
    });
    apps.push(app);
    return app;
  }

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    counter = new InMemoryFixedWindowCounter();
    apps = [];
    first = await processOver(counter);
    const created = await first.inject({
      method: 'POST',
      url: '/v1/me/api-tokens',
      headers: bearer(TOKENS.user),
      payload: { name: 'script', scopes: ['videos:read'] },
    });
    expect(created.statusCode).toBe(201);
    headers = bearer(created.json().token);
  });

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  it('sends no CORS headers to a token, and limits it to 60 requests a minute', async () => {
    const opening = await read(first);
    for (let n = 2; n <= 60; n += 1) await read(first);
    const limited = await read(first);

    expect(opening.statusCode).toBe(200);
    expect(opening.headers['access-control-allow-origin']).toBeUndefined();
    expect([limited.statusCode, limited.json().code]).toEqual([429, ErrorCodes.RATE_LIMITED]);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('counts a token across API processes that share one counter', async () => {
    const second = await processOver(counter);

    const statuses: number[] = [];
    for (let n = 0; n < 60; n += 1) {
      statuses.push((await read(n % 2 === 0 ? first : second)).statusCode);
    }
    const limited = await read(first);

    expect(new Set(statuses)).toEqual(new Set([200]));
    expect([limited.statusCode, limited.json().code]).toEqual([429, ErrorCodes.RATE_LIMITED]);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
});
