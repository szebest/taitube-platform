import * as net from 'node:net';
import { Adapters } from '@vp/adapters';
import { type AppConfig, inProcessAppConfig } from '@vp/env-schema';
import { composeApp } from '../app';
import { main, serve } from '../main';

const TIMINGS = { drainDelayMs: 150, graceMs: 2_000 };

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

  it('refuses a production boot without ADMIN_TOKEN before it binds a port', async () => {
    const port = await freePort();
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as unknown as typeof process.exit);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      main({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://vp:vp@localhost:5432/vp',
        PORT: String(port),
      })
    ).rejects.toThrow('ADMIN_TOKEN');

    expect(exit).toHaveBeenCalledWith(1);
    expect(await refusesConnections(port)).toBe(true);
  });

  it('finishes a request that is in flight when shutdown begins', async () => {
    const composed = await composeApp({ config: config() });
    let release = () => {};
    composed.app.get('/slow', async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { done: true };
    });
    const api = await serve(composed, config(), TIMINGS);

    const inFlight = fetch(`${api.address}/slow`);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const shutdown = api.shutdown();
    release();

    const response = await inFlight;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ done: true });
    expect(await shutdown).toBe('drained');
  });

  it('answers /readyz 503 at once while /livez stays 200 and the server still accepts', async () => {
    const api = await serve(await composeApp({ config: config() }), config(), TIMINGS);
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

  it('closes every adapter exactly once, a dependent before what it depends on', async () => {
    const composed = await composeApp({ config: config() });
    const closed: string[] = [];
    const { container } = composed;
    const adapters: Array<[string, { close(): Promise<unknown> }]> = [
      ['DbClient', container.get(Adapters.DbClient)],
      ['Cache', container.get(Adapters.Cache)],
      ['Storage', container.get(Adapters.Storage)],
      ['Multipart', container.get(Adapters.Multipart)],
      ['QueueRegistry', container.get(Adapters.QueueRegistry)],
    ];
    for (const [name, adapter] of adapters) {
      const close = adapter.close.bind(adapter);
      vi.spyOn(adapter, 'close').mockImplementation(async () => {
        closed.push(name);
        return close();
      });
    }
    const api = await serve(composed, config(), TIMINGS);

    expect(await api.shutdown()).toBe('drained');
    await api.shutdown();

    expect([...closed].sort()).toEqual([
      'Cache',
      'DbClient',
      'Multipart',
      'QueueRegistry',
      'Storage',
    ]);
    expect(closed.indexOf('Multipart')).toBeLessThan(closed.indexOf('Storage'));
  });

  it('gives up on a disposer that never resolves, and names it', async () => {
    const composed = await composeApp({ config: config() });
    vi.spyOn(composed.container.get(Adapters.Storage), 'close').mockImplementation(
      () => new Promise(() => {})
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const api = await serve(composed, config(), { drainDelayMs: 0, graceMs: 200 });

    expect(await api.shutdown()).toBe('forced');
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining('still waiting on Storage'));
  });
});
