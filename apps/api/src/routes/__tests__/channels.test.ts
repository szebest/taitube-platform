import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

const CREATOR = '11111111-1111-7111-8111-111111111111';
const CHANNEL = '22222222-2222-7222-8222-222222222222';

describe('public channel route', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const repositories = new InMemoryRepositories();
    await repositories.users.upsert({
      id: CREATOR,
      email: 'creator@example.com',
      role: 'CREATOR',
      tier: 'pro',
    });
    await repositories.channels.create({
      id: CHANNEL,
      userId: CREATOR,
      handle: 'makers',
      displayName: 'The Makers',
    });
    app = await buildApp({ adapters: { repositories } });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { lookup: 'its id', idOrHandle: CHANNEL },
    { lookup: 'its handle', idOrHandle: 'makers' },
    { lookup: 'its @handle', idOrHandle: '@makers' },
  ])('serves a channel anonymously by $lookup', async ({ idOrHandle }) => {
    const res = await app.inject({ method: 'GET', url: `/v1/channels/${idOrHandle}` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: CHANNEL, userId: CREATOR, handle: 'makers' });
  });

  it('answers 404 as a problem for a channel nobody holds', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/channels/@nobody_here' });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
  });
});
