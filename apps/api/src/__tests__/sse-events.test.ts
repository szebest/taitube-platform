import type { IncomingMessage } from 'node:http';
import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { publishVideoEvent } from '@vp/events';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { readSseUntil } from './sse-stream';

const OWNER_USER_ID = '00000000-0000-7000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-7000-8000-000000000002';
const PUBLIC_VIDEO_ID = '018f0000-0000-7000-8000-000000000010';
const PRIVATE_VIDEO_ID = '018f0000-0000-7000-8000-000000000020';
const PLAYBACK_URL = `http://localhost:9000/public/videos/${PUBLIC_VIDEO_ID}/hls/master.m3u8`;

describe('apps/api SSE video event streams', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let storage: InMemoryStorageClient;
  const ownerToken = mintToken({ sub: OWNER_USER_ID, role: 'user' });
  const otherToken = mintToken({ sub: OTHER_USER_ID, role: 'user' });

  beforeAll(async () => {
    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    storage = new InMemoryStorageClient();
    app = await buildApp({
      adapters: { repositories, cache, storage },
      config: inProcessAppConfig({ sse: { heartbeatMs: 100, idleTimeoutMs: 500, maxPerUser: 20 } }),
    });
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    cache.clear();

    await repositories.videos.create({
      id: PUBLIC_VIDEO_ID,
      ownerId: OWNER_USER_ID,
      title: 'Public Test Video',
      description: 'A public video',
      visibility: 'public',
      status: 'PROCESSING',
      sourceKey: `raw/${PUBLIC_VIDEO_ID}/source.mp4`,
      durationMs: 60000,
      width: 1920,
      height: 1080,
    });
    for (const [name, width, height, videoBitrateKbps] of [
      ['1080p', 1920, 1080, 4000],
      ['720p', 1280, 720, 2500],
    ] as const) {
      await repositories.renditions.create({
        id: `rend-${name}`,
        videoId: PUBLIC_VIDEO_ID,
        name,
        width,
        height,
        videoBitrateKbps,
        audioBitrateKbps: 128,
        status: 'PENDING',
      });
    }
    await repositories.videos.create({
      id: PRIVATE_VIDEO_ID,
      ownerId: OWNER_USER_ID,
      title: 'Private Test Video',
      description: 'A private video',
      visibility: 'private',
      status: 'PROCESSING',
      sourceKey: `raw/${PRIVATE_VIDEO_ID}/source.mp4`,
    });
  });

  it('writes snapshot, progress, status and ping frames in the SDD §10.1 wire format', async () => {
    let response: IncomingMessage | undefined;
    let published = false;

    const fullStream = await readSseUntil(`${baseUrl}/v1/videos/${PUBLIC_VIDEO_ID}/events`, {
      onResponse: (res) => {
        response = res;
      },
      onText: (text) => {
        if (published || !text.includes('event: snapshot') || !text.includes(': ping')) return;
        published = true;
        publishVideoEvent({
          ts: Date.now(),
          cache,
          videoId: PUBLIC_VIDEO_ID,
          event: 'progress',
          data: { rendition: '720p', percent: 50, overall: 25 },
          id: 101,
        });
        publishVideoEvent({
          ts: Date.now(),
          cache,
          videoId: PUBLIC_VIDEO_ID,
          event: 'status',
          data: { status: 'READY', playbackUrl: PLAYBACK_URL },
          id: 102,
        });
      },
      until: (text) => text.includes('event: progress') && text.includes('event: status'),
    });

    expect(response?.statusCode).toBe(200);
    expect(response?.headers['content-type']).toBe('text/event-stream');
    expect(response?.headers['cache-control']).toBe('no-cache');
    expect(response?.headers['x-accel-buffering']).toBe('no');
    expect(fullStream).toContain('event: snapshot\n');
    expect(fullStream).toMatch(/data: \{"videoId":".*","status":"PROCESSING"/);
    expect(fullStream).toContain(': ping\n\n');
    expect(fullStream).toContain('id: 101\nevent: progress\n');
    expect(fullStream).toContain('"rendition":"720p","percent":50,"overall":25');
    expect(fullStream).toContain('id: 102\nevent: status\n');
    expect(fullStream).toContain('"status":"READY"');
  });

  it('replays the events after Last-Event-ID on reconnect, including a missed READY', async () => {
    for (const [type, payload] of [
      ['progress', { rendition: '720p', percent: 50, overall: 25 }],
      ['progress', { rendition: '1080p', percent: 50, overall: 50 }],
      ['video.ready', { playbackUrl: PLAYBACK_URL }],
    ] as const) {
      await repositories.events.create({ videoId: PUBLIC_VIDEO_ID, type, payload });
    }
    await repositories.videos.transition({
      videoId: PUBLIC_VIDEO_ID,
      from: 'PROCESSING',
      to: 'READY',
      eventType: 'video.ready',
      patch: { playbackUrl: PLAYBACK_URL },
    });
    let statusCode: number | undefined;

    const text = await readSseUntil(`${baseUrl}/v1/videos/${PUBLIC_VIDEO_ID}/events`, {
      headers: { 'Last-Event-ID': '1' },
      onResponse: (res) => {
        statusCode = res.statusCode;
      },
      until: (received) => received.includes('id: 3') && received.includes('"status":"READY"'),
    });

    expect(statusCode).toBe(200);
    expect(text).toContain('event: snapshot');
    expect(text).toContain('id: 2');
    expect(text).toContain('id: 3');
    expect(text).toContain('event: status');
    expect(text).toContain('"status":"READY"');
  });

  it.each([
    {
      name: 'an anonymous viewer of a private video',
      url: `/v1/videos/${PRIVATE_VIDEO_ID}/events`,
      token: undefined,
      statusCode: 401,
      code: 'UNAUTHORIZED',
    },
    {
      name: 'a non-owner of a private video, without leaking that it exists',
      url: `/v1/videos/${PRIVATE_VIDEO_ID}/events`,
      token: otherToken,
      statusCode: 404,
      code: 'VIDEO_NOT_FOUND',
    },
    {
      name: 'a viewer of a video that does not exist',
      url: '/v1/videos/00000000-0000-7000-8000-000000000999/events',
      token: undefined,
      statusCode: 404,
      code: 'VIDEO_NOT_FOUND',
    },
    {
      name: 'an anonymous caller of the personal stream',
      url: '/v1/me/events',
      token: undefined,
      statusCode: 401,
      code: 'UNAUTHORIZED',
    },
  ])('refuses $name as GET /videos/:id would', async ({ url, token, statusCode, code }) => {
    const res = await app.inject({
      method: 'GET',
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

    expect(res.statusCode).toBe(statusCode);
    expect(JSON.parse(res.body).code).toBe(code);
  });

  it('delivers an event for one video through two API instances that share a cache', async () => {
    const sharedCache = new InMemoryCacheClient();
    const instances = await Promise.all(
      [0, 1].map(() =>
        buildApp({
          config: inProcessAppConfig(),
          adapters: { repositories, cache: sharedCache, storage },
        })
      )
    );
    const addresses = await Promise.all(
      instances.map((instance) => instance.listen({ port: 0, host: '127.0.0.1' }))
    );

    const streams = addresses.map((address) => {
      let snapshotSeen = () => {};
      const ready = new Promise<void>((resolve) => {
        snapshotSeen = resolve;
      });
      const done = readSseUntil(`${address}/v1/videos/${PUBLIC_VIDEO_ID}/events`, {
        onText: (text) => {
          if (text.includes('event: snapshot')) snapshotSeen();
        },
        until: (text) => text.includes('"overall":99'),
      });
      return { ready, done };
    });
    await Promise.all(streams.map((stream) => stream.ready));

    await publishVideoEvent({
      ts: Date.now(),
      cache: sharedCache,
      videoId: PUBLIC_VIDEO_ID,
      event: 'progress',
      data: { rendition: '720p', percent: 99, overall: 99 },
    });
    const received = await Promise.all(streams.map((stream) => stream.done));

    for (const text of received) expect(text).toContain('"percent":99,"overall":99');
    await Promise.all(instances.map((instance) => instance.close()));
  });

  it('streams status events on the user channel through GET /v1/me/events', async () => {
    let statusCode: number | undefined;
    let published = false;

    const full = await readSseUntil(`${baseUrl}/v1/me/events`, {
      headers: { authorization: `Bearer ${ownerToken}` },
      onResponse: (res) => {
        statusCode = res.statusCode;
      },
      onText: (text) => {
        if (published || !text.includes('event: snapshot')) return;
        published = true;
        publishVideoEvent({
          ts: Date.now(),
          cache,
          videoId: PUBLIC_VIDEO_ID,
          userId: OWNER_USER_ID,
          event: 'status',
          data: { status: 'PROCESSING' },
        });
      },
      until: (text) => text.includes('event: status') && text.includes('"status":"PROCESSING"'),
    });

    expect(statusCode).toBe(200);
    expect(full).toContain('event: snapshot');
    expect(full).toContain('event: status');
    expect(full).toContain('"status":"PROCESSING"');
  });
});
