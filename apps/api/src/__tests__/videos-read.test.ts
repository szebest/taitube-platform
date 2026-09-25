import type { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import type { FastifyInstance } from 'fastify';
import { TOKENS, backdate, bearer, buildTestApp, seedVideo } from './test-app';

const USER_A = SEEDED.userId;
const USER_B = SEEDED.otherUserId;
const BASE_TIME = 1700000000000;

describe('apps/api reading videos: keyset pagination and progress overlay', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  const tokenA = TOKENS.user;

  async function listTitles(url: string) {
    const res = await app.inject({ method: 'GET', url, headers: bearer(tokenA) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const titles: string[] = body.items.map((v: { title: string }) => v.title);
    return { titles, nextCursor: String(body.nextCursor) };
  }

  beforeAll(async () => {
    ({ app, repositories, cache } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
    cache.clear();
  });

  it('pages GET /v1/videos on (created_at DESC, id DESC) with an opaque cursor', async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const id = `018f0000-0000-7000-8000-00000000000${i}`;
      ids.push(id);
      await seedVideo(repositories, {
        id,
        ownerId: USER_A,
        title: `Video ${i}`,
        visibility: 'private',
      });
      await backdate(repositories, id, new Date(BASE_TIME + i * 1000));
    }

    const page1Res = await app.inject({
      method: 'GET',
      url: '/v1/videos?limit=2',
      headers: bearer(tokenA),
    });
    expect(page1Res.statusCode).toBe(200);
    const page1 = page1Res.json();
    expect(page1.items.map((v: { id: string }) => v.id)).toEqual([ids[4], ids[3]]);
    expect(page1.nextCursor).toBeDefined();

    const decodedCursor = JSON.parse(Buffer.from(page1.nextCursor, 'base64url').toString('utf8'));
    expect(decodedCursor.id).toBe(ids[3]);
    expect(decodedCursor.createdAt).toBeDefined();

    const page2Res = await app.inject({
      method: 'GET',
      url: `/v1/videos?limit=2&cursor=${page1.nextCursor}`,
      headers: bearer(tokenA),
    });
    expect(page2Res.statusCode).toBe(200);
    const page2 = page2Res.json();
    expect(page2.items.map((v: { id: string }) => v.id)).toEqual([ids[2], ids[1]]);
    expect(page2.nextCursor).toBeDefined();

    const page3Res = await app.inject({
      method: 'GET',
      url: `/v1/videos?limit=2&cursor=${page2.nextCursor}`,
      headers: bearer(tokenA),
    });
    expect(page3Res.statusCode).toBe(200);
    const page3 = page3Res.json();
    expect(page3.items.map((v: { id: string }) => v.id)).toEqual([ids[0]]);
    expect(page3.nextCursor).toBeNull();
  });

  it('keeps the next page stable when a newer video is inserted between requests', async () => {
    for (let i = 1; i <= 4; i++) {
      const id = `018f0000-0000-7000-8000-00000000001${i}`;
      await seedVideo(repositories, {
        id,
        ownerId: USER_A,
        title: `Existing ${i}`,
        visibility: 'private',
      });
      await backdate(repositories, id, new Date(BASE_TIME + i * 1000));
    }

    const first = await listTitles('/v1/videos?limit=2');
    expect(first.titles).toEqual(['Existing 4', 'Existing 3']);

    const newId = '018f0000-0000-7000-8000-000000000099';
    await seedVideo(repositories, {
      id: newId,
      ownerId: USER_A,
      title: 'Newer Inserted Video',
      visibility: 'private',
    });
    await backdate(repositories, newId, new Date(BASE_TIME + 100000));

    const second = await listTitles(`/v1/videos?limit=2&cursor=${first.nextCursor}`);
    expect(second.titles).toEqual(['Existing 2', 'Existing 1']);
  });

  it('scopes GET /v1/videos to the caller, filters by status and hides DELETED', async () => {
    for (const [n, ownerId, title, status] of [
      [21, USER_A, 'A Ready', 'READY'],
      [22, USER_A, 'A Processing', 'PROCESSING'],
      [23, USER_A, 'A Deleted', 'DELETED'],
      [24, USER_B, 'B Video', 'READY'],
    ] as const) {
      await seedVideo(repositories, {
        id: `018f0000-0000-7000-8000-0000000000${n}`,
        ownerId,
        title,
        status,
        visibility: 'private',
      });
    }

    const all = await listTitles('/v1/videos');
    expect(all.titles.sort()).toEqual(['A Processing', 'A Ready']);

    const ready = await listTitles('/v1/videos?status=READY');
    expect(ready.titles).toEqual(['A Ready']);

    const invalidCursor = await app.inject({
      method: 'GET',
      url: '/v1/videos?cursor=not-valid-base64!',
      headers: bearer(tokenA),
    });
    expect(invalidCursor.statusCode).toBe(400);
    expect(invalidCursor.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('overlays progress.byRendition and renditions[] on a PROCESSING video', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000041';
    await seedVideo(repositories, {
      id: videoId,
      ownerId: USER_A,
      title: 'Transcoding Video',
      status: 'PROCESSING',
    });
    await repositories.renditions.create({
      id: 'rend-1080p',
      videoId,
      name: '1080p',
      status: 'RUNNING',
      width: 1920,
      height: 1080,
      videoBitrateKbps: 4000,
      audioBitrateKbps: 128,
    });
    await repositories.renditions.create({
      id: 'rend-720p',
      videoId,
      name: '720p',
      status: 'DONE',
      width: 1280,
      height: 720,
      videoBitrateKbps: 2500,
      audioBitrateKbps: 128,
      playlistKey: `videos/${videoId}/hls/720p/index.m3u8`,
    });
    await repositories.events.create({
      videoId,
      type: 'transcode.progress',
      payload: { rendition: '1080p', percent: 60 },
    });

    const res = await app.inject({ method: 'GET', url: `/v1/videos/${videoId}` });

    expect(res.statusCode).toBe(200);
    const video = res.json();
    expect(video.status).toBe('PROCESSING');
    expect(video.renditions.length).toBe(2);
    const r1080p = video.renditions.find((r: { name: string }) => r.name === '1080p');
    const r720p = video.renditions.find((r: { name: string }) => r.name === '720p');
    expect(r1080p.status).toBe('RUNNING');
    expect(r720p.status).toBe('DONE');
    expect(r720p.playlistUrl).toBe(
      `http://localhost:9000/public/videos/${videoId}/hls/720p/index.m3u8`
    );
    expect(video.progress.byRendition['1080p']).toBe(60);
    expect(video.progress.byRendition['720p']).toBe(100);
    expect(video.progress.overall).toBe(80);
  });
});
