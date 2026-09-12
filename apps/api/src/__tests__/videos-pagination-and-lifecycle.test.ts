import { InMemoryCacheClient, InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('Videos API: Keyset pagination, metadata edits & visibility (Ticket 19)', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let storage: InMemoryStorageClient;

  const USER_A = '00000000-0000-7000-8000-000000000001';
  const USER_B = '00000000-0000-7000-8000-000000000002';
  const ADMIN_USER = '00000000-0000-7000-8000-000000000099';

  let tokenA: string;
  let tokenB: string;
  let adminToken: string;

  beforeAll(async () => {
    tokenA = mintToken({ sub: USER_A, role: 'user', ttl: '1h' });
    tokenB = mintToken({ sub: USER_B, role: 'user', ttl: '1h' });
    adminToken = mintToken({ sub: ADMIN_USER, role: 'admin', ttl: '1h' });

    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    storage = new InMemoryStorageClient();

    app = await buildApp({
      repositories,
      cache,
      storage,
      cdnBaseUrl: 'http://localhost:9000/public',
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
    cache.clear();
  });

  it('AC 1: GET /v1/videos performs keyset pagination on (created_at DESC, id DESC) with opaque cursor', async () => {
    const baseTime = 1700000000000;
    const ids: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const vid = `018f0000-0000-7000-8000-00000000000${i}`;
      ids.push(vid);
      await repositories.videos.create({
        id: vid,
        ownerId: USER_A,
        title: `Video ${i}`,
        visibility: 'private',
        status: 'READY',
        sourceKey: `raw/${vid}/source.mp4`,
      });
      const stored = await repositories.videos.findById(vid);
      if (stored) {
        stored.createdAt = new Date(baseTime + i * 1000);
      }
    }

    // Page 1: limit 2 -> expect videos 5 and 4
    const page1Res = await app.inject({
      method: 'GET',
      url: '/v1/videos?limit=2',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(page1Res.statusCode).toBe(200);
    const page1 = page1Res.json();
    expect(page1.items.length).toBe(2);
    expect(page1.items[0].id).toBe(ids[4]); // Video 5
    expect(page1.items[1].id).toBe(ids[3]); // Video 4
    expect(page1.nextCursor).toBeDefined();

    // Verify cursor is valid base64url JSON
    const decodedCursor = JSON.parse(Buffer.from(page1.nextCursor, 'base64url').toString('utf8'));
    expect(decodedCursor.id).toBe(ids[3]);
    expect(decodedCursor.createdAt).toBeDefined();

    // Page 2: limit 2 with cursor -> expect videos 3 and 2
    const page2Res = await app.inject({
      method: 'GET',
      url: `/v1/videos?limit=2&cursor=${page1.nextCursor}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(page2Res.statusCode).toBe(200);
    const page2 = page2Res.json();
    expect(page2.items.length).toBe(2);
    expect(page2.items[0].id).toBe(ids[2]); // Video 3
    expect(page2.items[1].id).toBe(ids[1]); // Video 2
    expect(page2.nextCursor).toBeDefined();

    // Page 3: limit 2 with cursor -> expect video 1 and null nextCursor
    const page3Res = await app.inject({
      method: 'GET',
      url: `/v1/videos?limit=2&cursor=${page2.nextCursor}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(page3Res.statusCode).toBe(200);
    const page3 = page3Res.json();
    expect(page3.items.length).toBe(1);
    expect(page3.items[0].id).toBe(ids[0]); // Video 1
    expect(page3.nextCursor).toBeNull();
  });

  it('AC 1: Keyset pagination is stable under concurrent inserts', async () => {
    const baseTime = 1700000000000;

    for (let i = 1; i <= 4; i++) {
      const vid = `018f0000-0000-7000-8000-00000000001${i}`;
      await repositories.videos.create({
        id: vid,
        ownerId: USER_A,
        title: `Existing ${i}`,
        visibility: 'private',
        status: 'READY',
        sourceKey: `raw/${vid}/source.mp4`,
      });
      const stored = await repositories.videos.findById(vid);
      if (stored) {
        stored.createdAt = new Date(baseTime + i * 1000);
      }
    }

    // Page 1: limit 2 -> returns [Existing 4, Existing 3]
    const p1Res = await app.inject({
      method: 'GET',
      url: '/v1/videos?limit=2',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const p1 = p1Res.json();
    expect(p1.items.map((it: { title: string }) => it.title)).toEqual(['Existing 4', 'Existing 3']);
    const cursor = p1.nextCursor;

    // Concurrently insert a brand new video (newer than any existing)
    const newId = '018f0000-0000-7000-8000-000000000099';
    await repositories.videos.create({
      id: newId,
      ownerId: USER_A,
      title: 'Newer Inserted Video',
      visibility: 'private',
      status: 'READY',
      sourceKey: `raw/${newId}/source.mp4`,
    });
    const newStored = await repositories.videos.findById(newId);
    if (newStored) {
      newStored.createdAt = new Date(baseTime + 100000);
    }

    // Page 2 using cursor must still return [Existing 2, Existing 1] without duplication or shift
    const p2Res = await app.inject({
      method: 'GET',
      url: `/v1/videos?limit=2&cursor=${cursor}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const p2 = p2Res.json();
    expect(p2.items.map((it: { title: string }) => it.title)).toEqual(['Existing 2', 'Existing 1']);
  });

  it('AC 1: GET /v1/videos scopes to caller and filters status & excludes DELETED', async () => {
    // User A videos
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000021',
      ownerId: USER_A,
      title: 'A Ready',
      visibility: 'private',
      status: 'READY',
      sourceKey: 'raw/21/source.mp4',
    });
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000022',
      ownerId: USER_A,
      title: 'A Processing',
      visibility: 'private',
      status: 'PROCESSING',
      sourceKey: 'raw/22/source.mp4',
    });
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000023',
      ownerId: USER_A,
      title: 'A Deleted',
      visibility: 'private',
      status: 'DELETED',
      sourceKey: 'raw/23/source.mp4',
    });

    // User B video
    await repositories.videos.create({
      id: '018f0000-0000-7000-8000-000000000024',
      ownerId: USER_B,
      title: 'B Video',
      visibility: 'private',
      status: 'READY',
      sourceKey: 'raw/24/source.mp4',
    });

    // Caller A should see only A Ready and A Processing (DELETED excluded)
    const resA = await app.inject({
      method: 'GET',
      url: '/v1/videos',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(resA.statusCode).toBe(200);
    const bodyA = resA.json();
    expect(bodyA.items.length).toBe(2);
    expect(bodyA.items.map((i: { title: string }) => i.title).sort()).toEqual([
      'A Processing',
      'A Ready',
    ]);

    // Status filter: ?status=READY
    const resFilter = await app.inject({
      method: 'GET',
      url: '/v1/videos?status=READY',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(resFilter.statusCode).toBe(200);
    const bodyFilter = resFilter.json();
    expect(bodyFilter.items.length).toBe(1);
    expect(bodyFilter.items[0].title).toBe('A Ready');

    // Invalid cursor returns 400 VALIDATION_FAILED
    const resInvalidCursor = await app.inject({
      method: 'GET',
      url: '/v1/videos?cursor=not-valid-base64!',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(resInvalidCursor.statusCode).toBe(400);
    expect(resInvalidCursor.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('AC 2: PATCH /v1/videos/:id optimistic locking (stale version -> 409 VERSION_CONFLICT)', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000031';
    await repositories.videos.create({
      id: videoId,
      ownerId: USER_A,
      title: 'Initial Title',
      description: 'Initial Description',
      visibility: 'private',
      status: 'READY',
      sourceKey: `raw/${videoId}/source.mp4`,
    });

    // 1. Successful PATCH with version: 1
    const patch1Res = await app.inject({
      method: 'PATCH',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        title: 'Updated Title',
        description: 'Updated Description',
        version: 1,
      },
    });
    expect(patch1Res.statusCode).toBe(200);
    const patch1 = patch1Res.json();
    expect(patch1.title).toBe('Updated Title');
    expect(patch1.description).toBe('Updated Description');
    expect(patch1.version).toBe(2);

    // Verify video.metadata_updated event was recorded
    const events = await repositories.events.findByVideoId(videoId);
    const metaEvent = events.find((e) => e.type === 'video.metadata_updated');
    expect(metaEvent).toBeDefined();
    expect((metaEvent?.payload as { newVersion: number }).newVersion).toBe(2);

    // 2. Stale PATCH with version: 1 again -> 409 VERSION_CONFLICT
    const patchConflictRes = await app.inject({
      method: 'PATCH',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        title: 'Conflicting Title',
        version: 1,
      },
    });
    expect(patchConflictRes.statusCode).toBe(409);
    expect(patchConflictRes.json().code).toBe(ErrorCodes.VERSION_CONFLICT);
  });

  it('AC 2: PATCH allows visibility transitions private <-> unlisted <-> public', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000032';
    await repositories.videos.create({
      id: videoId,
      ownerId: USER_A,
      title: 'Visibility Test',
      visibility: 'private',
      status: 'READY',
      sourceKey: `raw/${videoId}/source.mp4`,
    });

    // Transition: private -> unlisted (version 1 -> 2)
    const toUnlisted = await app.inject({
      method: 'PATCH',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { visibility: 'unlisted', version: 1 },
    });
    expect(toUnlisted.statusCode).toBe(200);
    expect(toUnlisted.json().visibility).toBe('unlisted');
    expect(toUnlisted.json().version).toBe(2);

    // Transition: unlisted -> public (version 2 -> 3)
    const toPublic = await app.inject({
      method: 'PATCH',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { visibility: 'public', version: 2 },
    });
    expect(toPublic.statusCode).toBe(200);
    expect(toPublic.json().visibility).toBe('public');
    expect(toPublic.json().version).toBe(3);

    // Transition: public -> private (version 3 -> 4)
    const toPrivate = await app.inject({
      method: 'PATCH',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { visibility: 'private', version: 3 },
    });
    expect(toPrivate.statusCode).toBe(200);
    expect(toPrivate.json().visibility).toBe('private');
    expect(toPrivate.json().version).toBe(4);
  });

  it('AC 2 & AC 3: Visibility access controls on GET and PATCH', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000033';
    await repositories.videos.create({
      id: videoId,
      ownerId: USER_A,
      title: 'Access Control Video',
      visibility: 'private',
      status: 'READY',
      sourceKey: `raw/${videoId}/source.mp4`,
    });

    // 1. Private video:
    // - Unauthenticated GET -> 401
    const unauthGet = await app.inject({
      method: 'GET',
      url: `/v1/videos/${videoId}`,
    });
    expect(unauthGet.statusCode).toBe(401);
    expect(unauthGet.json().code).toBe(ErrorCodes.UNAUTHORIZED);

    // - Non-owner User B GET -> 404 (does not leak existence)
    const userBGet = await app.inject({
      method: 'GET',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(userBGet.statusCode).toBe(404);
    expect(userBGet.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);

    // - Non-owner User B PATCH -> 404 (does not leak existence)
    const userBPatch = await app.inject({
      method: 'PATCH',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { title: 'Hack', version: 1 },
    });
    expect(userBPatch.statusCode).toBe(404);

    // - Admin GET and PATCH -> 200
    const adminGet = await app.inject({
      method: 'GET',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminGet.statusCode).toBe(200);

    const adminPatch = await app.inject({
      method: 'PATCH',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Admin Edit', visibility: 'unlisted', version: 1 },
    });
    expect(adminPatch.statusCode).toBe(200);
    expect(adminPatch.json().title).toBe('Admin Edit');

    // 2. Unlisted video:
    // - Unauthenticated GET -> 200 (readable by anyone with ID)
    const unauthUnlistedGet = await app.inject({
      method: 'GET',
      url: `/v1/videos/${videoId}`,
    });
    expect(unauthUnlistedGet.statusCode).toBe(200);

    // - Non-owner User B PATCH -> 403 (existence known, but edit forbidden)
    const userBUnlistedPatch = await app.inject({
      method: 'PATCH',
      url: `/v1/videos/${videoId}`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { title: 'Unauthorized Edit', version: 2 },
    });
    expect(userBUnlistedPatch.statusCode).toBe(403);
    expect(userBUnlistedPatch.json().code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('AC 5: GET /v1/videos/:id overlays progress.byRendition and renditions[] from DB for PROCESSING video', async () => {
    const videoId = '018f0000-0000-7000-8000-000000000041';
    await repositories.videos.create({
      id: videoId,
      ownerId: USER_A,
      title: 'Transcoding Video',
      visibility: 'public',
      status: 'PROCESSING',
      sourceKey: `raw/${videoId}/source.mp4`,
    });

    // Create renditions in DB
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

    // Create transcode.progress event for 1080p at 60%
    await repositories.events.create({
      videoId,
      type: 'transcode.progress',
      payload: {
        rendition: '1080p',
        percent: 60,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${videoId}`,
    });

    expect(res.statusCode).toBe(200);
    const video = res.json();
    expect(video.status).toBe('PROCESSING');

    // Renditions list from DB
    expect(video.renditions.length).toBe(2);
    const r1080p = video.renditions.find((r: { name: string }) => r.name === '1080p');
    const r720p = video.renditions.find((r: { name: string }) => r.name === '720p');
    expect(r1080p.status).toBe('RUNNING');
    expect(r720p.status).toBe('DONE');
    expect(r720p.playlistUrl).toBe(
      `http://localhost:9000/public/videos/${videoId}/hls/720p/index.m3u8`
    );

    // Progress overlay from DB: 1080p -> 60%, 720p (DONE) -> 100%
    expect(video.progress.byRendition['1080p']).toBe(60);
    expect(video.progress.byRendition['720p']).toBe(100);
    // Overall = (60 + 100) / 2 = 80%
    expect(video.progress.overall).toBe(80);
  });
});
