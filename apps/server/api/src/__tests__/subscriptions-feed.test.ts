import { expectOk } from '@vp/testing/result';
import {
  CDN,
  CHANNEL_1,
  CHANNEL_2,
  CREATOR_ID,
  OTHER_CREATOR_ID,
  type SubscriptionsApp,
  buildSubscriptionsApp,
  getAs,
  subscription,
} from './subscriptions-app';

describe('GET /v1/feed/subscriptions', () => {
  let ctx: SubscriptionsApp;
  let publicVideo1Id: string;
  let publicVideo2Id: string;

  beforeAll(async () => {
    ctx = await buildSubscriptionsApp();
    await subscription(ctx.app, 'POST', CHANNEL_1.id);
    await subscription(ctx.app, 'POST', CHANNEL_2.id);

    publicVideo1Id = expectOk(
      await ctx.repositories.videos.create({
        id: '77777777-7777-7777-8777-777777777771',
        ownerId: CREATOR_ID,
        title: 'Creator 1 Public Video',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/c1v1.mp4',
        posterKey: 'posters/c1v1.jpg',
        masterPlaylistKey: 'videos/c1v1/hls/master.m3u8',
      })
    ).id;
    await ctx.repositories.videos.create({
      id: '77777777-7777-7777-8777-777777777772',
      ownerId: CREATOR_ID,
      title: 'Creator 1 Private Video',
      visibility: 'private',
      status: 'READY',
      sourceKey: 'raw/c1v2.mp4',
    });
    publicVideo2Id = expectOk(
      await ctx.repositories.videos.create({
        id: '77777777-7777-7777-8777-777777777773',
        ownerId: OTHER_CREATOR_ID,
        title: 'Creator 2 Public Video',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/c2v1.mp4',
      })
    ).id;
    await ctx.repositories.videos.create({
      id: '77777777-7777-7777-8777-777777777774',
      ownerId: OTHER_CREATOR_ID,
      title: 'Creator 2 Processing Video',
      visibility: 'public',
      status: 'PROCESSING',
      sourceKey: 'raw/c2v2.mp4',
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('requires authentication (returns 401)', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/v1/feed/subscriptions' });
    expect(res.statusCode).toBe(401);
  });

  it('returns only READY and public videos from subscribed creators', async () => {
    const res = await getAs(ctx.app, '/v1/feed/subscriptions');

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.total).toBe(2);
    expect(data.items).toHaveLength(2);
    expect(data.items.map((v: { title: string }) => v.title).sort()).toEqual([
      'Creator 1 Public Video',
      'Creator 2 Public Video',
    ]);

    const c1v = data.items.find((v: { id: string }) => v.id === publicVideo1Id);
    expect(c1v.posterUrl).toBe(`${CDN}/posters/c1v1.jpg`);
    expect(c1v.playbackUrl).toBe(`${CDN}/videos/c1v1/hls/master.m3u8`);
    expect(data.items.some((v: { id: string }) => v.id === publicVideo2Id)).toBe(true);
  });

  it('pages the feed with a cursor', async () => {
    const page1 = await getAs(ctx.app, '/v1/feed/subscriptions?limit=1');

    expect(page1.statusCode).toBe(200);
    const data1 = page1.json();
    expect(data1.items).toHaveLength(1);
    expect(data1.nextCursor).not.toBeNull();

    const page2 = await getAs(ctx.app, `/v1/feed/subscriptions?limit=1&cursor=${data1.nextCursor}`);

    expect(page2.statusCode).toBe(200);
    const data2 = page2.json();
    expect(data2.items).toHaveLength(1);
    expect(data2.items[0].id).not.toBe(data1.items[0].id);
  });
});
