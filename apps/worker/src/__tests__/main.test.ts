import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { main } from '../main';

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function env(heartbeatPath: string, stage = 'probe') {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://vp:vp@localhost:5432/vp',
    METRICS_PORT: String(await freePort()),
    WORKER_STAGE: stage,
    WORKER_HEARTBEAT_PATH: heartbeatPath,
  };
}

describe('apps/worker: main', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-worker-main-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('consumes the stage the environment names, and writes the liveness heartbeat', async () => {
    const heartbeat = path.join(dir, 'heartbeat');
    const worker = await main(await env(heartbeat, 'notify'));

    expect(worker.runner.worker.name).toBe('notify');
    expect(Number(await fs.readFile(heartbeat, 'utf8'))).toBeGreaterThan(0);
    expect(await worker.shutdown()).toBe('drained');
  });

  it('serves its metrics on the configured port until it shuts down', async () => {
    const worker = await main(await env(path.join(dir, 'heartbeat')));

    const res = await fetch(`http://127.0.0.1:${worker.metricsPort}/metrics`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('bullmq_queue_jobs');

    expect(await worker.shutdown()).toBe('drained');
    await expect(fetch(`http://127.0.0.1:${worker.metricsPort}/metrics`)).rejects.toThrow();
  });

  it('closes the consumer once however many signals arrive', async () => {
    const worker = await main(await env(path.join(dir, 'heartbeat')));
    const close = vi.spyOn(worker.runner.queue, 'close');

    await Promise.all([worker.shutdown(), worker.shutdown()]);

    expect(close).toHaveBeenCalledTimes(1);
  });
});
