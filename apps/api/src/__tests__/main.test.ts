import * as net from 'node:net';
import { Adapters } from '@vp/adapters/composition';
import type { ProcessHost } from '@vp/composition';
import { type AppConfig, inProcessAppConfig } from '@vp/env-schema';
import type { Tracing } from '@vp/observability';
import { err, ok } from '@vp/result';
import { composeApp } from '../app';
import { Services } from '../composition/services.module';
import { main, run, serve } from '../main';

const tracing: Tracing = { shutdown: vi.fn(async () => ok()) };
const TIMINGS = { tracing, timings: { drainDelayMs: 50, graceMs: 2_000 } };

function host(env: Record<string, string>): ProcessHost & { exit: ReturnType<typeof vi.fn> } {
  return { env, onSignal: () => {}, exit: vi.fn() };
}

function config(): AppConfig {
  return inProcessAppConfig({ http: { port: 0, metricsPort: 0 } });
}

function refusesConnections(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(true));
  });
}

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

describe('apps/api: main', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses a production boot without its secrets before it binds a port', async () => {
    const port = await freePort();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const production = host({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://localhost:5432/vp',
      PORT: String(port),
    });

    await run(production);

    expect(production.exit).toHaveBeenCalledWith(1);
    expect(String(error.mock.calls.at(-1)?.[1])).toContain(
      'S3_ACCESS_KEY_ID: is required in production'
    );
    expect(await refusesConnections(port)).toBe(true);
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

  it('drains and exits 0, and never listens, on a SIGTERM that arrives while it boots', async () => {
    const port = await freePort();
    const booting = host({
      NODE_ENV: 'test',
      ADAPTER_FAMILY: 'in-memory',
      DATABASE_URL: 'postgres://localhost:5432/vp',
      PORT: String(port),
      METRICS_PORT: '0',
    });
    booting.onSignal = (signal, handler) => {
      if (signal === 'SIGTERM') handler();
    };

    await main(booting);

    await vi.waitFor(() => expect(booting.exit).toHaveBeenCalledWith(0));
    expect(await refusesConnections(port)).toBe(true);
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
