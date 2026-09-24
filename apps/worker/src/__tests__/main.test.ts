import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import type { ProcessHost } from '@vp/composition';
import { main, run } from '../main';

type Signal = Parameters<ProcessHost['onSignal']>[0];

async function boundPort(): Promise<{ port: number; release: () => Promise<void> }> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  return {
    port: (server.address() as net.AddressInfo).port,
    release: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function host(heartbeatPath: string, overrides: Record<string, string> = {}) {
  const handlers = new Map<Signal, () => void>();
  const exit = vi.fn<(code: number) => void>();
  const processHost: ProcessHost = {
    env: {
      NODE_ENV: 'test',
      ADAPTER_FAMILY: 'in-memory',
      DATABASE_URL: 'postgres://localhost:5432/vp',
      METRICS_PORT: '0',
      WORKER_STAGE: 'probe',
      WORKER_HEARTBEAT_PATH: heartbeatPath,
      ...overrides,
    },
    onSignal: (signal, handler) => void handlers.set(signal, handler),
    exit,
  };
  return { processHost, handlers, exit };
}

describe('apps/worker: main', () => {
  let dir: string;
  let heartbeat: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-worker-main-'));
    heartbeat = path.join(dir, 'heartbeat');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('consumes the stage the environment names, and writes the liveness heartbeat', async () => {
    const worker = await main(host(heartbeat, { WORKER_STAGE: 'notify' }).processHost);

    expect(worker.runner.worker.name).toBe('notify');
    expect(await fs.readFile(heartbeat, 'utf8')).toMatch(/^\d+\n$/);
    expect(await worker.shutdown()).toBe('drained');
  });

  it('serves its metrics, each process series once, and readiness until it shuts down', async () => {
    const worker = await main(host(heartbeat).processHost);
    const url = (route: string) => `http://127.0.0.1:${worker.metricsPort}${route}`;

    const scraped = await (await fetch(url('/metrics'))).text();
    expect(scraped).toContain('bullmq_queue_jobs');
    expect(scraped.match(/^# TYPE \S*process_cpu_seconds_total /gm)).toHaveLength(1);
    expect((await fetch(url('/readyz'))).status).toBe(200);

    expect(await worker.shutdown()).toBe('drained');
    await expect(fetch(url('/metrics'))).rejects.toThrow();
  });

  it('closes the consumer once however many signals arrive', async () => {
    const worker = await main(host(heartbeat).processHost);
    const close = vi.spyOn(worker.runner.queue, 'close');

    await Promise.all([worker.shutdown(), worker.shutdown()]);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('exits non-zero without consuming a job when its metrics port is already bound', async () => {
    const taken = await boundPort();
    const consume = vi.spyOn(InMemoryJobQueue.prototype, 'process');
    const { processHost, exit } = host(heartbeat, { METRICS_PORT: String(taken.port) });

    await run(processHost);

    expect(exit).toHaveBeenCalledWith(1);
    expect(consume).not.toHaveBeenCalled();
    await expect(fs.stat(heartbeat)).rejects.toMatchObject({ code: 'ENOENT' });
    await taken.release();
  });

  it('drains and exits 0 on a SIGTERM that arrives while it is still starting', async () => {
    const consume = vi.spyOn(InMemoryJobQueue.prototype, 'process');
    const { processHost, handlers, exit } = host(heartbeat);
    processHost.onSignal = (signal, handler) => {
      handlers.set(signal, handler);
      if (signal === 'SIGTERM') setImmediate(handler);
    };

    const worker = await main(processHost);
    await worker.shutdown();

    expect(exit).toHaveBeenCalledWith(0);
    expect(consume).not.toHaveBeenCalled();
  });
});
