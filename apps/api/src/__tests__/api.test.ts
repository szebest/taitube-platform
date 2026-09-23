import * as http from 'node:http';
import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { startMetricsServer } from '../plugins/metrics';

describe('apps/api HTTP and Auth foundations (AC 2, AC 6)', () => {
  let app: FastifyInstance;
  const repositories = new InMemoryRepositories();
  const cache = new InMemoryCacheClient();
  const storage = new InMemoryStorageClient();
  const cdnBase = 'http://localhost:9000/public';

  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  const SEED_VIDEO_ID = '018f0000-0000-7000-8000-000000000001';
  const OTHER_PRIVATE_VIDEO_ID = '018f0000-0000-7000-8000-000000000002';

  beforeAll(async () => {
    await repositories.videos.create({
      id: SEED_VIDEO_ID,
      ownerId: DEV_USER_ID,
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
      playbackUrl: `${cdnBase}/videos/${SEED_VIDEO_ID}/hls/master.m3u8`,
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

    await repositories.videos.create({
      id: OTHER_PRIVATE_VIDEO_ID,
      ownerId: '00000000-0000-7000-8000-000000000002',
      title: 'Other Private Video',
      visibility: 'private',
      status: 'READY',
      sourceKey: `raw/${OTHER_PRIVATE_VIDEO_ID}/source.mp4`,
    });

    app = await buildApp({
      adapters: {
        repositories,
        cache,
        storage,
      },
      config: inProcessAppConfig({ cdn: cdnBase }),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /healthz returns 200 liveness', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /livez returns 200 liveness (K8s alias)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/livez',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /.well-known/jwks.json returns valid Ed25519 dev JWKS', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/.well-known/jwks.json',
    });
    expect(res.statusCode).toBe(200);
    const jwks = res.json();
    expect(jwks.keys).toBeDefined();
    expect(jwks.keys.length).toBeGreaterThan(0);
    expect(jwks.keys[0].kty).toBe('OKP');
    expect(jwks.keys[0].crv).toBe('Ed25519');
  });

  it('AC 2: GET /v1/videos/:id with minted token returns 200 and §6.3 shape', async () => {
    const token = mintToken({
      sub: DEV_USER_ID,
      role: 'admin',
      ttl: '1h',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${SEED_VIDEO_ID}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Verify §6.3 response shape
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

  it('AC 2: private video with no token returns 401 problem+json with code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${OTHER_PRIVATE_VIDEO_ID}`,
      // No Authorization header
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

  it('AC 2: other owner + private video returns 404 (do not leak existence)', async () => {
    // User DEV_USER_ID is not the owner of OTHER_PRIVATE_VIDEO_ID
    const nonAdminToken = mintToken({
      sub: DEV_USER_ID,
      role: 'user', // non-admin
      ttl: '1h',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${OTHER_PRIVATE_VIDEO_ID}`,
      headers: {
        authorization: `Bearer ${nonAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json();
    expect(problem.status).toBe(404);
    expect(problem.code).toBe('VIDEO_NOT_FOUND');
  });

  it('AC 2: public or unlisted video returns 200 without token', async () => {
    // SEED_VIDEO_ID has visibility: public
    const res = await app.inject({
      method: 'GET',
      url: `/v1/videos/${SEED_VIDEO_ID}`,
      // No Authorization header
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(SEED_VIDEO_ID);
    expect(body.title).toBe('Test Sintel Trailer');
  });

  it('AC 6: /readyz returns 503 when Redis is stopped and 200 when back', async () => {
    // 1. When Redis is healthy
    cache.setHealthy(true);
    const resHealthy = await app.inject({
      method: 'GET',
      url: '/readyz',
    });
    expect(resHealthy.statusCode).toBe(200);
    expect(resHealthy.json()).toEqual({
      status: 'ok',
      checks: {
        postgres: 'ok',
        redis: 'ok',
        s3: 'ok',
      },
    });

    // 2. When Redis stops responding
    cache.setHealthy(false);
    const resDegraded = await app.inject({
      method: 'GET',
      url: '/readyz',
    });
    expect(resDegraded.statusCode).toBe(503);
    expect(resDegraded.json()).toEqual({
      status: 'degraded',
      checks: {
        postgres: 'ok',
        redis: 'failed',
        s3: 'ok',
      },
    });

    // 3. When Redis recovers
    cache.setHealthy(true);
    const resRecovered = await app.inject({
      method: 'GET',
      url: '/readyz',
    });
    expect(resRecovered.statusCode).toBe(200);
    expect(resRecovered.json().status).toBe('ok');
  });

  it('AC 6: /metrics is served on METRICS_PORT, not on API port', async () => {
    // 1. Verify Fastify API does NOT serve /metrics on the main port
    const resApi = await app.inject({
      method: 'GET',
      url: '/metrics',
    });
    expect(resApi.statusCode).toBe(404);

    // 2. Verify standalone metrics server serves Prometheus metrics on its port
    const testMetricsPort = 19464;
    const metricsServer = await startMetricsServer(testMetricsPort);

    try {
      const metricsResponse = await new Promise<string>((resolve, reject) => {
        http.get(`http://127.0.0.1:${testMetricsPort}/metrics`, (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toContain('text/plain');
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => resolve(data));
          res.on('error', reject);
        });
      });

      expect(metricsResponse).toContain('process_cpu_user_seconds_total');
      expect(metricsResponse).toContain('vp_api_');
    } finally {
      await metricsServer.close();
    }
  });
});
