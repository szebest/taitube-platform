import * as net from 'node:net';
import type { ProcessHost } from '@vp/composition';
import { run } from '../process';

function host(env: Record<string, string>): ProcessHost & { exit: ReturnType<typeof vi.fn> } {
  return { env, onSignal: () => {}, exit: vi.fn() };
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

describe('apps/api: process', () => {
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

    expect(await run(production)).toBeUndefined();

    expect(production.exit).toHaveBeenCalledWith(1);
    expect(String(error.mock.calls.at(-1)?.[1])).toContain(
      'S3_ACCESS_KEY_ID: is required in production'
    );
    expect(await refusesConnections(port)).toBe(true);
  });

  it('exits 1 with the bind error, and never listens, when its metrics port is already bound', async () => {
    const taken = net.createServer();
    await new Promise<void>((resolve) => taken.listen(0, '0.0.0.0', resolve));
    const metricsPort = (taken.address() as net.AddressInfo).port;
    const port = await freePort();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const booting = host({
      NODE_ENV: 'test',
      ADAPTER_FAMILY: 'in-memory',
      DATABASE_URL: 'postgres://localhost:5432/vp',
      PORT: String(port),
      METRICS_PORT: String(metricsPort),
    });

    expect(await run(booting)).toBeUndefined();

    expect(booting.exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.at(-1)?.[1]).toMatchObject({ code: 'EADDRINUSE' });
    expect(await refusesConnections(port)).toBe(true);
    await new Promise<void>((resolve) => taken.close(() => resolve()));
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

    const api = await run(booting);
    await api?.shutdown();

    expect(api).toBeDefined();
    expect(booting.exit).toHaveBeenCalledWith(0);
    expect(await refusesConnections(port)).toBe(true);
  });
});
