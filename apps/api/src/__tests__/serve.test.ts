import { Adapters } from '@vp/adapters/composition';
import { type AppConfig, inProcessAppConfig } from '@vp/env-schema';
import type { Tracing } from '@vp/observability';
import { err, ok } from '@vp/result';
import { composeApp } from '../app';
import { Services } from '../composition/services.module';
import { serve } from '../serve';

const tracing: Tracing = { shutdown: vi.fn(async () => ok()) };
const TIMINGS = { tracing, timings: { drainDelayMs: 50, graceMs: 2_000 } };

function config(): AppConfig {
  return inProcessAppConfig({ http: { port: 0, metricsPort: 0 } });
}

describe('apps/api: serve', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finishes a request that is in flight when shutdown begins', async () => {
    const composed = await composeApp({ config: config() });
    let release = () => {};
    let entered = () => {};
    const handling = new Promise<void>((resolve) => {
      entered = resolve;
    });
    composed.app.get('/slow', async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { done: true };
    });
    const api = await serve(composed, config(), TIMINGS);

    const inFlight = fetch(`${api.address}/slow`);
    await handling;
    const shutdown = api.shutdown();
    release();

    const response = await inFlight;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ done: true });
    expect(await shutdown).toBe('drained');
  });

  it('answers /readyz 503 at once while /livez stays 200 and the server still accepts', async () => {
    const api = await serve(await composeApp({ config: config() }), config(), {
      tracing,
      timings: { drainDelayMs: 250, graceMs: 2_000 },
    });
    expect((await fetch(`${api.address}/readyz`)).status).toBe(200);

    const shutdown = api.shutdown();
    const [ready, live] = await Promise.all([
      fetch(`${api.address}/readyz`),
      fetch(`${api.address}/livez`),
    ]);

    expect(ready.status).toBe(503);
    expect(await ready.json()).toMatchObject({ status: 'degraded' });
    expect(live.status).toBe(200);
    expect(await shutdown).toBe('drained');
  });

  it('releases every resource exactly once, in reverse construction order', async () => {
    const composed = await composeApp({ config: config() });
    const { container } = composed;
    const released: string[] = [];
    const resources: Array<[string, object, 'close' | 'stop']> = [
      ['DbClient', container.get(Adapters.DbClient), 'close'],
      ['Cache', container.get(Adapters.Cache), 'close'],
      ['Storage', container.get(Adapters.Storage), 'close'],
      ['Multipart', container.get(Adapters.Multipart), 'close'],
      ['QueueRegistry', container.get(Adapters.QueueRegistry), 'close'],
      ['CategoryCache', container.get(Adapters.CategoryCache), 'close'],
      ['SseHub', container.get(Services.SseHub), 'close'],
      ['MetricsServer', container.get(Services.MetricsServer), 'close'],
      ['QueuePoller', container.get(Services.QueuePoller), 'stop'],
      ['SqlPoller', container.get(Services.SqlPoller), 'stop'],
    ];
    for (const [name, resource, method] of resources) {
      const target = resource as Record<string, () => unknown>;
      const original = target[method]?.bind(resource);
      vi.spyOn(target, method).mockImplementation(() => {
        released.push(name);
        return original?.();
      });
    }
    const api = await serve(composed, config(), TIMINGS);

    expect(await api.shutdown()).toBe('drained');
    await api.shutdown();

    expect(released).toEqual([
      'DbClient',
      'CategoryCache',
      'Multipart',
      'Storage',
      'SqlPoller',
      'QueuePoller',
      'QueueRegistry',
      'SseHub',
      'Cache',
      'MetricsServer',
    ]);
  });

  it('fails the shutdown when a disposer returns an error, and names it', async () => {
    const composed = await composeApp({ config: config() });
    vi.spyOn(composed.container.get(Adapters.Storage), 'close').mockResolvedValue(
      err('bucket gone') as never
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const api = await serve(composed, config(), TIMINGS);

    expect(await api.shutdown()).toBe('failed');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Storage'));
  });

  it('flushes buffered spans once the servers have closed', async () => {
    const flushed: Tracing = { shutdown: vi.fn(async () => ok()) };
    const api = await serve(await composeApp({ config: config() }), config(), {
      ...TIMINGS,
      tracing: flushed,
    });

    expect(await api.shutdown()).toBe('drained');
    expect(flushed.shutdown).toHaveBeenCalledTimes(1);
  });

  it('gives up on a disposer that never resolves, and names it', async () => {
    const composed = await composeApp({ config: config() });
    vi.spyOn(composed.container.get(Adapters.Storage), 'close').mockImplementation(
      () => new Promise(() => {})
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const api = await serve(composed, config(), {
      tracing,
      timings: { drainDelayMs: 0, graceMs: 100 },
    });

    expect(await api.shutdown()).toBe('forced');
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining('still waiting on Storage'));
  });
});
