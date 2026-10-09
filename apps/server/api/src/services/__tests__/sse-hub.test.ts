import type { ServerResponse } from 'node:http';
import { PassThrough, Writable } from 'node:stream';
import { InMemoryCacheClient } from '@vp/adapters/in-memory';
import type { PatternMessageListener } from '@vp/core/ports';
import { type CacheUnavailable, ErrorCodes, cacheUnavailable } from '@vp/errors';
import { videoChannel } from '@vp/events';
import { createMetricsRegistry } from '@vp/observability';
import { type Result, err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { SseHub, type SseHubOptions } from '../sse-hub';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000e1';
const VIEWER_ID = '00000000-0000-7000-8000-0000000000e2';

class UnsubscribableCache extends InMemoryCacheClient {
  isReachable = false;

  override async psubscribe(
    pattern: string,
    listener: PatternMessageListener
  ): Promise<Result<void, CacheUnavailable>> {
    if (!this.isReachable) return err(cacheUnavailable('psubscribe'));
    return super.psubscribe(pattern, listener);
  }
}

describe('apps/api/services: SseHub', () => {
  let cache: UnsubscribableCache;
  let hub: SseHub;
  let chunks: string[];

  function newHub(overrides: Partial<SseHubOptions> = {}): SseHub {
    return new SseHub({
      cache,
      metrics: createMetricsRegistry(),
      maxConnectionsPerUser: 20,
      maxPodConnections: 5000,
      heartbeatMs: 10_000,
      idleTimeoutMs: 10_000,
      ...overrides,
    });
  }

  function register(channel: string, userId?: string) {
    return hub.register({
      channel,
      userId,
      rawResponse: new PassThrough() as unknown as ServerResponse,
    });
  }

  beforeEach(() => {
    cache = new UnsubscribableCache();
    hub = newHub();
    chunks = [];
  });

  afterEach(async () => {
    await hub.close();
  });

  function attach(): void {
    const stream = new Writable({
      write(chunk, _encoding, done) {
        chunks.push(String(chunk));
        done();
      },
    });
    expectOk(
      hub.register({
        channel: videoChannel(VIDEO_ID),
        userId: VIEWER_ID,
        rawResponse: stream as unknown as ServerResponse,
      })
    ).markLive();
  }

  async function publishProgress(): Promise<void> {
    await cache.publish(
      videoChannel(VIDEO_ID),
      JSON.stringify({
        event: 'progress',
        data: { percent: 45, rendition: '720p' },
        timestamp: new Date().toISOString(),
      })
    );
  }

  it('delivers a published event to a registered connection', async () => {
    cache.isReachable = true;
    expectOk(await hub.init());
    attach();

    await publishProgress();

    const output = chunks.join('');
    expect(output).toContain('event: progress');
    expect(output).toContain('"percent":45');
    expect(output).toContain('"rendition":"720p"');
  });

  it('subscribes once when two streams ask it to at the same time', async () => {
    cache.isReachable = true;
    const psubscribe = vi.spyOn(cache, 'psubscribe');

    const [first, second] = await Promise.all([hub.init(), hub.init()]);

    expectOk(first);
    expectOk(second);
    expect(psubscribe).toHaveBeenCalledTimes(2);
  });

  it('reports a cache that cannot take the wildcard subscription', async () => {
    expect(expectErr(await hub.init()).code).toBe(ErrorCodes.CACHE_UNAVAILABLE);
  });

  it('opens no silently empty stream: a hub whose init failed delivers nothing', async () => {
    expectErr(await hub.init());
    attach();

    await publishProgress();

    expect(chunks).toEqual([]);
  });

  it('does not claim to be subscribed after a failed init, so a retry subscribes', async () => {
    expectErr(await hub.init());

    cache.isReachable = true;
    expectOk(await hub.init());
    attach();
    await publishProgress();

    expect(chunks.join('')).toContain('"percent":45');
  });

  it('counts the connections it holds and releases them on close', async () => {
    cache.isReachable = true;
    expectOk(await hub.init());
    attach();

    expect(hub.getActiveConnectionCount()).toBe(1);
    expect(hub.getUserConnectionCount(VIEWER_ID)).toBe(1);

    await hub.close();

    expect(hub.getActiveConnectionCount()).toBe(0);
  });

  it('refuses to register once it is closed', async () => {
    cache.isReachable = true;
    expectOk(await hub.init());
    await hub.close();

    expect(
      expectErr(
        hub.register({
          channel: videoChannel(VIDEO_ID),
          rawResponse: new PassThrough() as unknown as ServerResponse,
        })
      ).message
    ).toContain('shutting down');
  });

  it('refuses a user their 21st stream until one of the 20 closes', () => {
    const connections = Array.from({ length: 20 }, () =>
      expectOk(register('video:test', VIEWER_ID))
    );
    expect(hub.getUserConnectionCount(VIEWER_ID)).toBe(20);

    expect(expectErr(register('video:test', VIEWER_ID)).message).toMatch(
      /Maximum active SSE streams \(20\) exceeded/
    );

    connections[0]?.close();
    expect(hub.getUserConnectionCount(VIEWER_ID)).toBe(19);

    expectOk(register('video:test', VIEWER_ID));
    expect(hub.getUserConnectionCount(VIEWER_ID)).toBe(20);
  });

  it('refuses a stream past the pod cap until one closes', async () => {
    await hub.close();
    hub = newHub({ maxPodConnections: 3 });
    const connections = ['video:1', 'video:2', 'video:3'].map((channel) =>
      expectOk(register(channel))
    );

    expect(expectErr(register('video:4')).message).toMatch(
      /Maximum pod SSE connection limit reached/
    );

    connections[0]?.close();
    expect(expectOk(register('video:4'))).toBeDefined();
  });
});
