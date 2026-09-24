import * as http from 'node:http';
import * as net from 'node:net';
import type { ProcessHost } from '@vp/composition';
import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { run } from '../process';
import { boundPort } from './bound-port';

function host(env: Record<string, string>): ProcessHost & { exit: ReturnType<typeof vi.fn> } {
  return { env, onSignal: () => {}, exit: vi.fn() };
}

function loggerTo(log: ReturnType<typeof captureLog>) {
  return createLogger({
    format: 'json',
    service: 'vp-api',
    level: 'info',
    destination: log.destination,
  });
}

const IN_MEMORY_BOOT = {
  NODE_ENV: 'test',
  ADAPTER_FAMILY: 'in-memory',
  DATABASE_URL: 'postgres://localhost:5432/vp',
  PORT: '0',
};

describe('apps/api: process', () => {
  it('refuses a production boot without its secrets before it binds a port', async () => {
    const listens = vi.spyOn(http.Server.prototype, 'listen');
    const log = captureLog();
    const production = host({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://localhost:5432/vp',
      PORT: '0',
    });

    expect(await run(production, loggerTo(log))).toBeUndefined();

    expect(production.exit).toHaveBeenCalledWith(1);
    expect(log.text()).toContain('S3_ACCESS_KEY_ID: is required in production');
    expect(listens).not.toHaveBeenCalled();
  });

  it('exits 1 with the bind error, and never listens, when its metrics port is already bound', async () => {
    const taken = net.createServer();
    await new Promise<void>((resolve) => taken.listen(0, '0.0.0.0', resolve));
    const metricsPort = boundPort(taken);
    const listens = vi.spyOn(http.Server.prototype, 'listen');
    const log = captureLog();
    const booting = host({ ...IN_MEMORY_BOOT, METRICS_PORT: String(metricsPort) });

    expect(await run(booting, loggerTo(log))).toBeUndefined();

    expect(booting.exit).toHaveBeenCalledWith(1);
    expect(log.lines().at(-1)).toMatchObject({
      msg: 'api could not start',
      err: { code: 'EADDRINUSE' },
    });
    expect(listens).toHaveBeenCalledTimes(1);
    await new Promise<void>((resolve) => taken.close(() => resolve()));
  });

  it('drains and exits 0, and never listens, on a SIGTERM that arrives while it boots', async () => {
    const booting = host({ ...IN_MEMORY_BOOT, METRICS_PORT: '0' });
    booting.onSignal = (signal, handler) => {
      if (signal === 'SIGTERM') handler();
    };

    const api = await run(booting, loggerTo(captureLog()));
    await api?.shutdown();

    expect(api?.address).toBe('');
    expect(booting.exit).toHaveBeenCalledWith(0);
  });
});
