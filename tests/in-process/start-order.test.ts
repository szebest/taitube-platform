import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { inProcessAppConfig } from '@vp/env-schema';
import { mediaTools } from '@vp/ffmpeg';
import { LogContext, createLogger } from '@vp/logger';
import { composeApp } from '../../apps/api/src/app';
import { composeWorker } from '../../apps/worker/src/runner';

interface StartOrder {
  /** What must be up first: the scrape endpoint, and on a worker its liveness file. */
  probes: readonly string[];
  /** What takes work from outside: a queue consumer, a subscription, a poller, a scheduler. */
  consumers: readonly string[];
}

/** Every consumer is started, and after every probe; the answer names each one that is not. */
function consumersStartedEarly(started: readonly string[], order: StartOrder): string[] {
  const lastProbe = Math.max(...order.probes.map((probe) => started.indexOf(probe)));
  const missing = [...order.probes, ...order.consumers].filter((name) => !started.includes(name));
  const early = order.consumers.filter((name) => started.indexOf(name) < lastProbe);
  return [
    ...missing.map((name) => `${name} never started`),
    ...early.map((name) => `${name} early`),
  ];
}

const API: StartOrder = {
  probes: ['MetricsServer'],
  consumers: ['SseHub', 'QueuePoller', 'SqlPoller', 'HousekeepingQueue', 'CategoryCache'],
};

const WORKER: StartOrder = {
  probes: ['MetricsServer', 'Heartbeat'],
  consumers: ['Consumer', 'OutboxRelay'],
};

describe('in-process: consumers start after the metrics server and the heartbeat', () => {
  it.each([
    { order: ['MetricsServer', 'Heartbeat', 'Consumer', 'OutboxRelay'], expected: [] },
    {
      order: ['Consumer', 'MetricsServer', 'Heartbeat', 'OutboxRelay'],
      expected: ['Consumer early'],
    },
    { order: ['MetricsServer', 'Consumer', 'OutboxRelay'], expected: ['Heartbeat never started'] },
  ])('reads $order', ({ order, expected }) => {
    expect(consumersStartedEarly(order, WORKER)).toEqual(expected);
  });

  it('starts the API metrics server before any subscription, poller or scheduler', async () => {
    const { app, container } = await composeApp({ config: inProcessAppConfig() });

    expect((await container.start()).ok).toBe(true);
    expect(consumersStartedEarly(container.started(), API)).toEqual([]);
    await app.close();
  });

  it('starts the worker metrics server and heartbeat before its consumer', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-start-order-'));
    const runner = await composeWorker({
      config: inProcessAppConfig({
        worker: { stage: 'housekeeping', heartbeatPath: path.join(dir, 'heartbeat') },
      }),
      logger: createLogger({ format: 'json', service: 'start-order', level: 'silent' }),
      logContext: new LogContext(),
      media: mediaTools,
      workerId: 'start-order',
    });

    expect((await runner.start()).ok).toBe(true);
    expect(consumersStartedEarly(runner.started(), WORKER)).toEqual([]);
    await runner.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
});
