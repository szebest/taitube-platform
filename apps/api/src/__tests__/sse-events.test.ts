import * as http from 'node:http';
import { PassThrough } from 'node:stream';
import { InMemoryCacheClient, InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters';
import { mintToken } from '@vp/dev-token';
import { publishVideoEvent, videoChannel } from '@vp/events';
import { expectErr, expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { SseConnection } from '../services/sse-connection';
import { SseHub } from '../services/sse-hub';

describe('Ticket 15: SSE Live Status, Progress, Snapshot, Replay, Heartbeat & Backpressure', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let storage: InMemoryStorageClient;

  const OWNER_USER_ID = '00000000-0000-7000-8000-000000000001';
  const OTHER_USER_ID = '00000000-0000-7000-8000-000000000002';
  const PUBLIC_VIDEO_ID = '018f0000-0000-7000-8000-000000000010';
  const PRIVATE_VIDEO_ID = '018f0000-0000-7000-8000-000000000020';

  let ownerToken: string;
  let otherToken: string;

  beforeAll(async () => {
    ownerToken = mintToken({ sub: OWNER_USER_ID, role: 'user' });
    otherToken = mintToken({ sub: OTHER_USER_ID, role: 'user' });

    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    storage = new InMemoryStorageClient();

    app = await buildApp({
      adapters: {
        repositories,
        cache,
        storage,
      },
      limits: {
        sseHeartbeatMs: 100,
        sseIdleTimeoutMs: 500,
        sseMaxPerUser: 20,
      },
    });

    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = address;
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

    await repositories.renditions.create({
      id: 'rend-1080p',
      videoId: PUBLIC_VIDEO_ID,
      name: '1080p',
      width: 1920,
      height: 1080,
      videoBitrateKbps: 4000,
      audioBitrateKbps: 128,
      status: 'PENDING',
    });
    await repositories.renditions.create({
      id: 'rend-720p',
      videoId: PUBLIC_VIDEO_ID,
      name: '720p',
      width: 1280,
      height: 720,
      videoBitrateKbps: 2500,
      audioBitrateKbps: 128,
      status: 'PENDING',
    });

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

  // AC 1: Wire format matches SDD §10.1 (id = video_events.id, event in snapshot|progress|status, : ping every 15s)
  it('AC 1: Wire format conforms to SDD §10.1 (snapshot, progress, status, and : ping)', async () => {
    const receivedChunks: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const req = http.get(`${baseUrl}/v1/videos/${PUBLIC_VIDEO_ID}/events`, async (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');
        expect(res.headers['x-accel-buffering']).toBe('no');

        res.on('data', (chunk) => {
          receivedChunks.push(chunk.toString());
          const totalText = receivedChunks.join('');

          // Once snapshot and ping are received, publish a live progress and status event
          if (totalText.includes('event: snapshot') && totalText.includes(': ping')) {
            // Publish progress event
            publishVideoEvent({
              cache,
              videoId: PUBLIC_VIDEO_ID,
              event: 'progress',
              data: { rendition: '720p', percent: 50, overall: 25 },
              id: 101,
            });

            // Publish status event
            publishVideoEvent({
              cache,
              videoId: PUBLIC_VIDEO_ID,
              event: 'status',
              data: {
                status: 'READY',
                playbackUrl: `http://localhost:9000/public/videos/${PUBLIC_VIDEO_ID}/hls/master.m3u8`,
              },
              id: 102,
            });
          }

          if (totalText.includes('event: progress') && totalText.includes('event: status')) {
            req.destroy();
            resolve();
          }
        });

        res.on('error', reject);
      });
      req.on('error', (err) => {
        if ((err as any).code !== 'ECONNRESET') reject(err);
      });
    });

    const fullStream = receivedChunks.join('');

    // Check snapshot wire format
    expect(fullStream).toContain('event: snapshot\n');
    expect(fullStream).toMatch(/data: \{"videoId":".*","status":"PROCESSING"/);

    // Check heartbeat comment
    expect(fullStream).toContain(': ping\n\n');

    // Check progress frame wire format
    expect(fullStream).toContain('id: 101\nevent: progress\n');
    expect(fullStream).toContain('"rendition":"720p","percent":50,"overall":25');

    // Check status frame wire format
    expect(fullStream).toContain('id: 102\nevent: status\n');
    expect(fullStream).toContain('"status":"READY"');
  });

  // AC 2: First frame after connect is snapshot from Postgres, then live events; subscribe-before-read ordering, deduplicated by id
  it('AC 2: Subscribe-before-read order delivers snapshot first and deduplicates events fired during connect', async () => {
    // Seed initial event in DB
    const initialEvent = await repositories.events.create({
      videoId: PUBLIC_VIDEO_ID,
      type: 'progress',
      payload: { rendition: '720p', percent: 10, overall: 5 },
    });

    // We create an SseConnection directly with a mock ServerResponse to assert exact ordering & deduplication
    const writtenFrames: string[] = [];
    const mockRes = new PassThrough();
    mockRes.on('data', (c) => writtenFrames.push(c.toString()));

    const connection = new SseConnection({
      channel: videoChannel(PUBLIC_VIDEO_ID),
      rawResponse: mockRes as any,
    });

    // 1. Simulate an event fired DURING connect (before DB snapshot returns)
    // Event with id = initialEvent.id (already in DB)
    connection.onLiveEvent({
      id: expectOk(initialEvent).id,
      event: 'progress',
      data: { rendition: '720p', percent: 10, overall: 5 },
    });
    // Another event fired during connect with id = initialEvent.id + 1 (new event)
    connection.onLiveEvent({
      id: expectOk(initialEvent).id + 1,
      event: 'progress',
      data: { rendition: '720p', percent: 20, overall: 10 },
    });

    // Nothing written yet because connection is in connecting phase
    expect(writtenFrames.length).toBe(0);

    // 2. DB snapshot returns and is sent
    connection.sendSnapshot(
      {
        videoId: PUBLIC_VIDEO_ID,
        status: 'PROCESSING',
        progress: { overall: 5, byRendition: { '720p': 10 } },
      },
      expectOk(initialEvent).id
    );

    // 3. Mark live with snapshot ID
    connection.markLive(expectOk(initialEvent).id);

    // Assertions:
    // Frame 0 is snapshot
    expect(writtenFrames[0]).toContain('event: snapshot');
    expect(writtenFrames[0]).toContain(`id: ${expectOk(initialEvent).id}`);

    // Frame 1 is the new event (id + 1), and event (initialEvent.id) was deduplicated!
    expect(writtenFrames.length).toBe(2);
    expect(writtenFrames[1]).toContain(`id: ${expectOk(initialEvent).id + 1}`);
    expect(writtenFrames[1]).toContain('"percent":20');

    connection.close();
  });

  // AC 3: Reconnect with Last-Event-ID replays video_events after that id; client that missed READY receives it on reconnect
  it('AC 3: Reconnect with Last-Event-ID replays missed events including terminal READY status', async () => {
    // Seed events: 1 (progress), 2 (progress), 3 (video.ready)
    await repositories.events.create({
      videoId: PUBLIC_VIDEO_ID,
      type: 'progress',
      payload: { rendition: '720p', percent: 50, overall: 25 },
    });
    await repositories.events.create({
      videoId: PUBLIC_VIDEO_ID,
      type: 'progress',
      payload: { rendition: '1080p', percent: 50, overall: 50 },
    });
    await repositories.events.create({
      videoId: PUBLIC_VIDEO_ID,
      type: 'video.ready',
      payload: {
        playbackUrl: `http://localhost:9000/public/videos/${PUBLIC_VIDEO_ID}/hls/master.m3u8`,
      },
    });

    // Update video to READY in repository
    await repositories.videos.transition({
      videoId: PUBLIC_VIDEO_ID,
      from: 'PROCESSING',
      to: 'READY',
      eventType: 'video.ready',
      patch: {
        playbackUrl: `http://localhost:9000/public/videos/${PUBLIC_VIDEO_ID}/hls/master.m3u8`,
      },
    });

    const receivedChunks: string[] = [];

    await new Promise<void>((resolve, reject) => {
      // Reconnect with Last-Event-ID: 1 (missed events 2 and 3)
      const req = http.get(
        `${baseUrl}/v1/videos/${PUBLIC_VIDEO_ID}/events`,
        {
          headers: {
            'Last-Event-ID': '1',
          },
        },
        (res) => {
          expect(res.statusCode).toBe(200);

          res.on('data', (chunk) => {
            receivedChunks.push(chunk.toString());
            const text = receivedChunks.join('');
            if (text.includes('id: 3') && text.includes('"status":"READY"')) {
              req.destroy();
              resolve();
            }
          });
          res.on('error', reject);
        }
      );
      req.on('error', (err) => {
        if ((err as any).code !== 'ECONNRESET') reject(err);
      });
    });

    const text = receivedChunks.join('');
    // Snapshot first
    expect(text).toContain('event: snapshot');
    // Replay includes event 2 and 3
    expect(text).toContain('id: 2');
    expect(text).toContain('id: 3');
    expect(text).toContain('event: status');
    expect(text).toContain('"status":"READY"');
  });

  // AC 4: Progress events streamed in real-time over SSE
  it('AC 4: Progress events streamed in real-time over SSE', async () => {
    const hub = new SseHub({ cache });
    await hub.init();

    const stream = new PassThrough();
    const conn = hub.register({
      channel: `video:${PUBLIC_VIDEO_ID}`,
      userId: OWNER_USER_ID,
      rawResponse: stream as any,
    });
    expectOk(conn).markLive();

    const chunks: string[] = [];
    stream.on('data', (c) => chunks.push(c.toString()));

    await cache.publish(
      `video:${PUBLIC_VIDEO_ID}`,
      JSON.stringify({
        event: 'progress',
        data: { percent: 45, rendition: '720p' },
        timestamp: new Date().toISOString(),
      })
    );

    // Yield to event loop to allow stream listener to receive chunks
    await new Promise((r) => setTimeout(r, 20));

    const output = chunks.join('');
    expect(output).toContain('event: progress');
    expect(output).toContain('"percent":45');
    expect(output).toContain('"rendition":"720p"');

    expectOk(conn).close();
    await hub.close();
  });

  // AC 5: Limits enforced: 20 streams/user -> 429; per-pod cap; idle streams closed at 30 min; authorisation identical to GET /videos/:id
  describe('AC 5: Limits and Authorization', () => {
    it('enforces authorization identically to GET /videos/:id', async () => {
      // 1. Private video unauthenticated -> 401
      const res1 = await app.inject({
        method: 'GET',
        url: `/v1/videos/${PRIVATE_VIDEO_ID}/events`,
      });
      expect(res1.statusCode).toBe(401);
      const prob1 = JSON.parse(res1.body);
      expect(prob1.code).toBe('UNAUTHORIZED');

      // 2. Private video by non-owner -> 404 VIDEO_NOT_FOUND (do not leak existence)
      const res2 = await app.inject({
        method: 'GET',
        url: `/v1/videos/${PRIVATE_VIDEO_ID}/events`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(res2.statusCode).toBe(404);
      const prob2 = JSON.parse(res2.body);
      expect(prob2.code).toBe('VIDEO_NOT_FOUND');

      // 3. Non-existent video -> 404
      const res3 = await app.inject({
        method: 'GET',
        url: '/v1/videos/00000000-0000-7000-8000-000000000999/events',
      });
      expect(res3.statusCode).toBe(404);

      // 4. GET /v1/me/events unauthenticated -> 401
      const res4 = await app.inject({
        method: 'GET',
        url: '/v1/me/events',
      });
      expect(res4.statusCode).toBe(401);
    });

    it('enforces 20 active streams per user returning 429 RATE_LIMITED', async () => {
      const hub = new SseHub({ cache, maxConnectionsPerUser: 20 });
      const connections: any[] = [];

      for (let i = 0; i < 20; i++) {
        const dummyRes = new PassThrough();
        const conn = hub.register({
          channel: 'video:test',
          userId: OWNER_USER_ID,
          rawResponse: dummyRes as any,
        });
        connections.push(expectOk(conn));
      }

      expect(hub.getUserConnectionCount(OWNER_USER_ID)).toBe(20);

      // 21st connection must be refused as RATE_LIMITED
      expect(
        expectErr(
          hub.register({
            channel: 'video:test',
            userId: OWNER_USER_ID,
            rawResponse: new PassThrough() as any,
          })
        ).message
      ).toMatch(/Maximum active SSE streams \(20\) exceeded/);

      // Clean up one connection
      const firstConn = connections[0];
      firstConn?.close();
      expect(hub.getUserConnectionCount(OWNER_USER_ID)).toBe(19);

      // Now 21st connection succeeds
      const newConn = expectOk(
        hub.register({
          channel: 'video:test',
          userId: OWNER_USER_ID,
          rawResponse: new PassThrough() as any,
        })
      );
      connections.push(newConn);
      expect(hub.getUserConnectionCount(OWNER_USER_ID)).toBe(20);

      await hub.close();
    });

    it('enforces pod connection cap via SseHub', async () => {
      const hub = new SseHub({
        cache,
        maxPodConnections: 3,
      });

      const dummyRes = new PassThrough();
      const conns = [
        hub.register({ channel: 'video:1', rawResponse: dummyRes as any }),
        hub.register({ channel: 'video:2', rawResponse: dummyRes as any }),
        hub.register({ channel: 'video:3', rawResponse: dummyRes as any }),
      ];

      expect(
        expectErr(hub.register({ channel: 'video:4', rawResponse: dummyRes as any })).message
      ).toMatch(/Maximum pod SSE connection limit reached/);

      expectOk(conns[0] as ReturnType<SseHub['register']>).close();
      expect(
        expectOk(hub.register({ channel: 'video:4', rawResponse: dummyRes as any }))
      ).toBeDefined();

      await hub.close();
    });

    it('closes idle streams after configured timeout', async () => {
      let closed = false;
      const dummyRes = new PassThrough();
      const conn = new SseConnection({
        channel: 'video:idle',
        rawResponse: dummyRes as any,
        idleTimeoutMs: 50, // 50ms timeout for test
      });

      conn.on('close', () => {
        closed = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(closed).toBe(true);
    });
  });

  // AC 6: Backpressure: slow reader socket coalesces progress events (latest wins) and never drops status events
  it('AC 6: Backpressure coalesces progress events (latest wins) and never drops status events', async () => {
    // Custom writable stream that simulates backpressure (write returns false)
    const writtenFrames: string[] = [];
    let canWrite = true;

    const mockRes = new PassThrough();
    mockRes.write = ((chunk: any) => {
      writtenFrames.push(chunk.toString());
      return canWrite;
    }) as any;

    const conn = new SseConnection({
      channel: videoChannel(PUBLIC_VIDEO_ID),
      rawResponse: mockRes as any,
    });
    conn.markLive(0);

    // Initial normal write
    conn.onLiveEvent({
      id: 1,
      event: 'progress',
      data: { rendition: '720p', percent: 10, overall: 5 },
    });
    expect(writtenFrames.length).toBe(1);

    // Now simulate backpressure kicking in (client paused or slow socket)
    canWrite = false;
    // This write returns false, triggering backpressure mode
    conn.onLiveEvent({
      id: 2,
      event: 'progress',
      data: { rendition: '720p', percent: 20, overall: 10 },
    });

    // While backpressured, multiple progress events arrive for 720p
    conn.onLiveEvent({
      id: 3,
      event: 'progress',
      data: { rendition: '720p', percent: 30, overall: 15 },
    });
    conn.onLiveEvent({
      id: 4,
      event: 'progress',
      data: { rendition: '720p', percent: 40, overall: 20 },
    });
    // And an event for 1080p
    conn.onLiveEvent({
      id: 5,
      event: 'progress',
      data: { rendition: '1080p', percent: 15, overall: 25 },
    });

    // And a critical terminal STATUS event arrives while backpressured!
    conn.onLiveEvent({
      id: 6,
      event: 'status',
      data: { status: 'READY', playbackUrl: 'http://cdn/master.m3u8' },
    });

    // None of the backpressured events were written to the socket yet
    expect(writtenFrames.length).toBe(2); // Initial write + the one that triggered backpressure

    // Now the slow client resumes reading -> 'drain' event fires!
    canWrite = true;
    mockRes.emit('drain');

    // After drain:
    // 1. Progress events were coalesced: 720p has ONLY 40% (latest wins; 30% dropped), 1080p has 15%
    // 2. Status event READY was NOT dropped and is written!
    const postDrainText = writtenFrames.slice(2).join('');
    expect(postDrainText).toContain('"rendition":"720p","percent":40');
    expect(postDrainText).not.toContain('"rendition":"720p","percent":30');
    expect(postDrainText).toContain('"rendition":"1080p","percent":15');
    expect(postDrainText).toContain('event: status\ndata: {"status":"READY"');

    conn.close();
  });

  // AC 7: Two API instances behind a round-robin both deliver events for the same video
  it('AC 7: Two API instances subscribe independently and deliver events for the same video', async () => {
    // Shared Redis / cache instance
    const sharedCache = new InMemoryCacheClient();

    const app1 = await buildApp({
      adapters: {
        repositories,
        cache: sharedCache,
        storage,
      },
    });
    const addr1 = await app1.listen({ port: 0, host: '127.0.0.1' });

    const app2 = await buildApp({
      adapters: {
        repositories,
        cache: sharedCache,
        storage,
      },
    });
    const addr2 = await app2.listen({ port: 0, host: '127.0.0.1' });

    const app1Received: string[] = [];
    const app2Received: string[] = [];

    const connectTo = (url: string, collector: string[]) =>
      new Promise<void>((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.on('data', (c) => {
            collector.push(c.toString());
            if (collector.join('').includes('"overall":99')) {
              req.destroy();
              resolve();
            }
          });
          res.on('error', reject);
        });
        req.on('error', (err) => {
          if ((err as any).code !== 'ECONNRESET') reject(err);
        });
      });

    const p1 = connectTo(`${addr1}/v1/videos/${PUBLIC_VIDEO_ID}/events`, app1Received);
    const p2 = connectTo(`${addr2}/v1/videos/${PUBLIC_VIDEO_ID}/events`, app2Received);

    // Wait a brief tick for both to connect and receive snapshots
    await new Promise((r) => setTimeout(r, 100));

    // Worker publishes to shared cache
    await publishVideoEvent({
      cache: sharedCache,
      videoId: PUBLIC_VIDEO_ID,
      event: 'progress',
      data: { rendition: '720p', percent: 99, overall: 99 },
    });

    await Promise.all([p1, p2]);

    expect(app1Received.join('')).toContain('"percent":99,"overall":99');
    expect(app2Received.join('')).toContain('"percent":99,"overall":99');

    await app1.close();
    await app2.close();
  });

  // Additional: GET /v1/me/events works and streams events for user's videos
  it('GET /v1/me/events connects and receives status events for user channel', async () => {
    const received: string[] = [];
    let published = false;

    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        `${baseUrl}/v1/me/events`,
        { headers: { authorization: `Bearer ${ownerToken}` } },
        (res) => {
          expect(res.statusCode).toBe(200);

          res.on('data', (chunk) => {
            received.push(chunk.toString());
            const text = received.join('');
            if (text.includes('event: snapshot') && !published) {
              published = true;
              // Publish event to user's channel
              publishVideoEvent({
                cache,
                videoId: PUBLIC_VIDEO_ID,
                userId: OWNER_USER_ID,
                event: 'status',
                data: { status: 'PROCESSING' },
              });
            }

            if (text.includes('event: status') && text.includes('"status":"PROCESSING"')) {
              req.destroy();
              resolve();
            }
          });
          res.on('error', reject);
        }
      );
      req.on('error', (err) => {
        if ((err as any).code !== 'ECONNRESET') reject(err);
      });
    });

    const full = received.join('');
    expect(full).toContain('event: snapshot');
    expect(full).toContain('event: status');
    expect(full).toContain('"status":"PROCESSING"');
  });
});
