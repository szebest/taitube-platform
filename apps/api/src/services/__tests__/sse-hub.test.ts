import type { ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';
import { InMemoryCacheClient } from '@vp/adapters/in-memory';
import type { PatternMessageListener } from '@vp/core/ports';
import { type CacheUnavailable, ErrorCodes, cacheUnavailable } from '@vp/errors';
import { videoChannel } from '@vp/events';
import { type Result, err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { SseHub } from '../sse-hub';

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

  beforeEach(() => {
    cache = new UnsubscribableCache();
    hub = new SseHub({
      cache,
      maxConnectionsPerUser: 20,
      maxPodConnections: 5000,
      heartbeatMs: 10_000,
      idleTimeoutMs: 10_000,
    });
    chunks = [];
  });

  afterEach(async () => {
    await hub.close();
  });

  function attach(): void {
    const stream = new PassThrough();
    stream.on('data', (chunk) => chunks.push(String(chunk)));
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
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  it('delivers a published event to a registered connection', async () => {
    cache.isReachable = true;
    expectOk(await hub.init());
    attach();

    await publishProgress();

    expect(chunks.join('')).toContain('"percent":45');
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
});
