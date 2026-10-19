import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../__tests__/test-app';

const CREATOR = '11111111-1111-7111-8111-111111111111';
const CHANNEL = '22222222-2222-7222-8222-222222222222';
const VIDEO = '33333333-3333-7333-8333-333333333333';

describe('public channel route', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const testApp = await buildTestApp();
    app = testApp.app;
    const { repositories } = testApp;
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
    await repositories.videos.create({
      id: VIDEO,
      ownerId: CREATOR,
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${VIDEO}.mp4`,
    });
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
    expect(res.json()).toMatchObject({
      id: CHANNEL,
      userId: CREATOR,
      handle: 'makers',
      links: [],
      videoCount: 1,
      totalViews: 0,
    });
  });

  it('serves the public videos of a channel anonymously, each under its card', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/channels/@makers/videos' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      items: [{ id: VIDEO, channel: { id: CHANNEL, handle: 'makers' } }],
      nextCursor: null,
      total: 1,
    });
  });

  it('answers 400 as a problem for a cursor it never issued', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/channels/@makers/videos?cursor=nope',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ErrorCodes.INVALID_CURSOR);
  });

  it.each([
    { route: 'the channel', url: '/v1/channels/@nobody_here' },
    { route: 'its videos', url: '/v1/channels/@nobody_here/videos' },
  ])('answers 404 as a problem for $route of a channel nobody holds', async ({ url }) => {
    const res = await app.inject({ method: 'GET', url });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
  });
});
