import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../__tests__/test-app';

const CREATOR = '11111111-1111-7111-8111-111111111111';
const CHANNEL = '22222222-2222-7222-8222-222222222222';
const VIDEO = '33333333-3333-7333-8333-333333333333';
const SHORT = '77777777-7777-7777-8777-777777777777';
const PUBLIC_PLAYLIST = '44444444-4444-7444-8444-444444444444';
const PRIVATE_PLAYLIST = '55555555-5555-7555-8555-555555555555';
const VIDEO_ITEM = '66666666-6666-7666-8666-666666666666';

describe('public channel route', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  beforeAll(async () => {
    const testApp = await buildTestApp();
    app = testApp.app;
    ({ repositories } = testApp);
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
      posterKey: 'posters/cover.jpg',
    });
    for (const [id, visibility] of [
      [PUBLIC_PLAYLIST, 'public'],
      [PRIVATE_PLAYLIST, 'private'],
    ] as const) {
      await repositories.playlists.create({
        id,
        ownerId: CREATOR,
        title: `List ${visibility}`,
        description: '',
        visibility,
      });
    }
    await repositories.playlists.addItem(PUBLIC_PLAYLIST, { id: VIDEO_ITEM, videoId: VIDEO });
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

  it('serves the public playlists of a channel anonymously, with their count and thumbnails', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/channels/@makers/playlists' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      items: [
        {
          id: PUBLIC_PLAYLIST,
          title: 'List public',
          videoCount: 1,
          thumbnailUrls: [expect.stringMatching(/posters\/cover\.jpg$/)],
        },
      ],
      nextCursor: null,
    });
  });

  it.each([
    { route: 'its videos', url: '/v1/channels/@makers/videos?cursor=nope' },
    { route: 'its playlists', url: '/v1/channels/@makers/playlists?cursor=nope' },
  ])('answers 400 as a problem for $route with a cursor it never issued', async ({ url }) => {
    const res = await app.inject({ method: 'GET', url });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ErrorCodes.INVALID_CURSOR);
  });

  it.each([
    { route: 'the channel', url: '/v1/channels/@nobody_here' },
    { route: 'its videos', url: '/v1/channels/@nobody_here/videos' },
    { route: 'its playlists', url: '/v1/channels/@nobody_here/playlists' },
  ])('answers 404 as a problem for $route of a channel nobody holds', async ({ url }) => {
    const res = await app.inject({ method: 'GET', url });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
  });

  it.each([
    { format: undefined, ids: [VIDEO] },
    { format: 'standard', ids: [VIDEO] },
    { format: 'short', ids: [SHORT] },
  ])('lists the $format videos of a channel, standard ones by default', async ({ format, ids }) => {
    await repositories.videos.create({
      id: SHORT,
      ownerId: CREATOR,
      visibility: 'public',
      status: 'READY',
      format: 'short',
      sourceKey: `raw/${SHORT}.mp4`,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/channels/@makers/videos${format ? `?format=${format}` : ''}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((item: { id: string }) => item.id)).toEqual(ids);
  });
});
