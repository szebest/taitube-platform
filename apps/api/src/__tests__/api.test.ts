import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ok } from '@vp/result';
import { SEEDED } from '@vp/testing';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../app';
import { serve } from '../serve';
import { TOKENS, bearer, buildTestApp, seedVideo } from './test-app';

describe('HTTP and auth foundations', () => {
  let app: FastifyInstance;
  const cdnBase = 'http://localhost:9000/public';

  const SEED_VIDEO_ID = SEEDED.videoId;
  const OTHER_PRIVATE_VIDEO_ID = SEEDED.otherVideoId;

  beforeAll(async () => {
    const testApp = await buildTestApp({ config: inProcessAppConfig({ cdn: cdnBase }) });
    app = testApp.app;
    const { repositories } = testApp;
    await repositories.videos.create({
      id: SEED_VIDEO_ID,
      ownerId: SEEDED.userId,
      title: 'Test Sintel Trailer',
      description: 'Sintel trailer test video',
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${SEED_VIDEO_ID}/source.mp4`,
      durationMs: 52000,
      width: 1920,
      height: 1080,
      ladder: [
        { name: '1080p', width: 1920, height: 1080 },
        { name: '720p', width: 1280, height: 720 },
        { name: '480p', width: 854, height: 480 },
      ],
      masterPlaylistKey: `videos/${SEED_VIDEO_ID}/hls/master.m3u8`,
      posterKey: `videos/${SEED_VIDEO_ID}/thumbs/poster.jpg`,
      spriteKey: `videos/${SEED_VIDEO_ID}/thumbs/sprite.jpg`,
    });

    await repositories.renditions.create({
      id: 'rend-1',
      videoId: SEED_VIDEO_ID,
      name: '1080p',
      width: 1920,
      height: 1080,
      videoBitrateKbps: 4000,
      audioBitrateKbps: 128,
      status: 'DONE',
      playlistKey: `videos/${SEED_VIDEO_ID}/hls/1080p/index.m3u8`,
    });
    await repositories.renditions.create({
      id: 'rend-2',
      videoId: SEED_VIDEO_ID,
      name: '720p',
      width: 1280,
      height: 720,
      videoBitrateKbps: 2500,
      audioBitrateKbps: 128,
      status: 'DONE',
      playlistKey: `videos/${SEED_VIDEO_ID}/hls/720p/index.m3u8`,
    });
    await repositories.renditions.create({
      id: 'rend-3',
      videoId: SEED_VIDEO_ID,
      name: '480p',
      width: 854,
      height: 480,
      videoBitrateKbps: 1200,
      audioBitrateKbps: 96,
      status: 'DONE',
      playlistKey: `videos/${SEED_VIDEO_ID}/hls/480p/index.m3u8`,
    });

    await seedVideo(repositories, {
      id: OTHER_PRIVATE_VIDEO_ID,
      ownerId: SEEDED.otherUserId,
      title: 'Other Private Video',
      visibility: 'private',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/videos/:id with a minted token returns 200 and the SDD §6.3 shape', async () => {
    const token = mintToken({ sub: SEEDED.userId, role: 'admin', ttl: '1h' });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${SEED_VIDEO_ID}`,
      headers: bearer(token),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.id).toBe(SEED_VIDEO_ID);
    expect(body.title).toBe('Test Sintel Trailer');
    expect(body.status).toBe('READY');
    expect(body.visibility).toBe('public');
    expect(body.progress.overall).toBe(100);
    expect(body.progress.byRendition['1080p']).toBe(100);
    expect(body.playbackUrl).toBe(`${cdnBase}/videos/${SEED_VIDEO_ID}/hls/master.m3u8`);
    expect(body.posterUrl).toBe(`${cdnBase}/videos/${SEED_VIDEO_ID}/thumbs/poster.jpg`);
    expect(body.spriteUrl).toBe(`${cdnBase}/videos/${SEED_VIDEO_ID}/thumbs/sprite.jpg`);
    expect(body.spriteVttUrl).toBe(`${cdnBase}/videos/${SEED_VIDEO_ID}/thumbs/sprite.vtt`);
    expect(body.renditions.length).toBe(3);
    expect(body.renditions[0].playlistUrl).toBe(
      `${cdnBase}/videos/${SEED_VIDEO_ID}/hls/1080p/index.m3u8`
    );
    expect(body.version).toBe(1);
    expect(body.createdAt).toBeDefined();
  });

  it('answers an anonymous read of a private video with 401 problem+json', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${OTHER_PRIVATE_VIDEO_ID}`,
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json();
    expect(problem.status).toBe(401);
    expect(problem.code).toBe('UNAUTHORIZED');
    expect(problem.type).toBe('https://errors.video-pipeline.local/UNAUTHORIZED');
    expect(problem.instance).toBe(`/v1/videos/${OTHER_PRIVATE_VIDEO_ID}`);
    expect(problem.detail).toBeDefined();
  });

  it("hides another owner's private video behind a 404", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${OTHER_PRIVATE_VIDEO_ID}`,
      headers: bearer(TOKENS.user),
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json();
    expect(problem.status).toBe(404);
    expect(problem.code).toBe('VIDEO_NOT_FOUND');
  });

  it('serves a public video without a token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${SEED_VIDEO_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(SEED_VIDEO_ID);
    expect(body.title).toBe('Test Sintel Trailer');
  });

  it('serves /metrics on the metrics port, never on the API port, with each process series once', async () => {
    expect((await app.inject({ method: 'GET', url: '/metrics' })).statusCode).toBe(404);

    const config = inProcessAppConfig({ http: { port: 0 } });
    const api = await serve(await composeApp({ config }), config, {
      tracing: { shutdown: async () => ok() },
      timings: { drainDelayMs: 0, graceMs: 2_000 },
    });

    const scraped = await fetch(`http://127.0.0.1:${api.metricsPort}/metrics`);
    expect(scraped.status).toBe(200);
    expect(scraped.headers.get('content-type')).toContain('text/plain');
    const text = await scraped.text();
    expect(text).toContain('http_request_duration_seconds');
    expect(text.match(/^# TYPE \S*process_cpu_seconds_total /gm)).toHaveLength(1);

    expect(await api.shutdown()).toBe('drained');
  });
});
