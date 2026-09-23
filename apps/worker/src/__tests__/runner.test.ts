import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { queueUnavailable } from '@vp/errors';
import { createLogger } from '@vp/observability';
import { err } from '@vp/result';
import { createWorkerRunner } from '../runner';

const logger = createLogger({ service: 'runner-test', level: 'silent' });

describe('apps/worker: createWorkerRunner', () => {
  it('consumes the configured stage over the in-memory family', async () => {
    const runner = await createWorkerRunner({
      config: inProcessAppConfig({ worker: { stage: 'package' } }),
      logger,
    });

    expect(runner.worker.name).toBe('package');
    expect(runner.outboxRelay).toBeUndefined();
    await runner.close();
  });

  it('consumes the queue a caller hands it, and leaves that queue to the caller', async () => {
    const jobQueue = new InMemoryJobQueue('probe');
    const close = vi.spyOn(jobQueue, 'close');

    const runner = await createWorkerRunner({
      config: inProcessAppConfig({ worker: { stage: 'probe' } }),
      adapters: { jobQueue, repositories: new InMemoryRepositories() },
      logger,
    });
    await runner.close();

    expect(runner.queue).toBe(jobQueue);
    expect(close).not.toHaveBeenCalled();
  });

  it('rejects its close, naming the disposer that failed', async () => {
    const runner = await createWorkerRunner({
      config: inProcessAppConfig({ worker: { stage: 'package' } }),
      logger,
    });
    vi.spyOn(runner.queue, 'close').mockResolvedValue(err(queueUnavailable('close', 'gone')));

    await expect(runner.close()).rejects.toThrow('disposers failed: QueueRegistry');
  });

  it('starts the outbox relay for housekeeping and stops it on close', async () => {
    const runner = await createWorkerRunner({
      config: inProcessAppConfig({ worker: { stage: 'housekeeping' } }),
      logger,
      outboxRelayIntervalMs: 60_000,
    });

    expect(runner.outboxRelay?.isRunning()).toBe(true);
    await runner.close();
    expect(runner.outboxRelay?.isRunning()).toBe(false);
  });

  it('names nothing still being disposed once it has closed', async () => {
    const runner = await createWorkerRunner({ config: inProcessAppConfig(), logger });

    await runner.close();

    expect(runner.disposing()).toBeUndefined();
  });
});
