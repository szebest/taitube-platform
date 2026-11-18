import * as net from 'node:net';
import { Registry } from 'prom-client';
import { MetricsServer, type MetricsServerOptions } from '../server';

const ROUTES = { metrics: '/metrics', health: '/healthz', ready: '/readyz' };

describe('@kit/observability: MetricsServer', () => {
  const servers: MetricsServer[] = [];

  async function listening(options: Partial<MetricsServerOptions> = {}): Promise<MetricsServer> {
    const server = new MetricsServer({
      port: 0,
      host: '127.0.0.1',
      registry: new Registry(),
      routes: ROUTES,
      ...options,
    });
    servers.push(server);
    expect((await server.listen()).ok).toBe(true);
    return server;
  }

  const get = (server: MetricsServer, path: string) =>
    fetch(`http://127.0.0.1:${server.port}${path}`);

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it('serves the registry on /metrics and liveness on /healthz', async () => {
    const server = await listening();

    const metrics = await get(server, '/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.headers.get('content-type')).toContain('text/plain');
    expect(await (await get(server, '/healthz')).text()).toBe('ok');
  });

  it('serves the routes it is handed', async () => {
    const server = await listening({
      routes: { metrics: '/scrape', health: '/live', ready: '/ready' },
      ready: async () => true,
    });

    expect((await get(server, '/scrape')).status).toBe(200);
    expect(await (await get(server, '/live')).text()).toBe('ok');
    expect((await get(server, '/ready')).status).toBe(200);
    expect((await get(server, '/metrics')).status).toBe(404);
  });

  it.each([
    { path: '/unknown', options: {} },
    { path: '/readyz', options: {} },
  ])('answers 404 on $path when it serves nothing there', async ({ path, options }) => {
    expect((await get(await listening(options), path)).status).toBe(404);
  });

  it.each([
    { answer: async () => true, status: 200 },
    { answer: async () => false, status: 503 },
    { answer: () => Promise.reject(new Error('redis is gone')), status: 503 },
  ])('answers $status on /readyz from its readiness check', async ({ answer, status }) => {
    expect((await get(await listening({ ready: answer }), '/readyz')).status).toBe(status);
  });

  it('reports a port already bound as a failed listen instead of throwing', async () => {
    const taken = net.createServer();
    await new Promise<void>((resolve) => taken.listen(0, '127.0.0.1', resolve));
    const { port } = taken.address() as net.AddressInfo;

    const server = new MetricsServer({
      port,
      host: '127.0.0.1',
      registry: new Registry(),
      routes: ROUTES,
    });
    const listened = await server.listen();

    expect(listened.ok ? undefined : (listened.error as NodeJS.ErrnoException).code).toBe(
      'EADDRINUSE'
    );
    await new Promise<void>((resolve) => taken.close(() => resolve()));
  });

  it('closes a server that never listened without failing', async () => {
    const server = new MetricsServer({
      port: 0,
      host: '127.0.0.1',
      registry: new Registry(),
      routes: ROUTES,
    });

    expect(await server.close()).toEqual({ ok: true, value: undefined });
  });
});
