import type { FlowProducerPort, JobQueue, Repositories } from '@vp/core/ports';
import { type Logger, type PipelineMetrics, getMetrics } from '@vp/observability';

export interface OutboxRelayOptions {
  repositories: Repositories;
  getQueue?: (name: string) => JobQueue;
  flowProducer?: FlowProducerPort;
  batchSize?: number;
  intervalMs?: number;
  logger?: Logger;
  metrics?: PipelineMetrics;
}

export interface DrainOutboxResult {
  processedCount: number;
  successCount: number;
  failureCount: number;
}

export async function drainOutboxOnce(
  repositories: Repositories,
  options: {
    getQueue?: (name: string) => JobQueue;
    flowProducer?: FlowProducerPort;
    batchSize?: number;
    logger?: Logger;
  }
): Promise<DrainOutboxResult> {
  const { getQueue, flowProducer, batchSize = 50, logger } = options;
  const startMs = Date.now();
  const items = await repositories.outbox.claimBatch(batchSize);

  let successCount = 0;
  let failureCount = 0;

  for (const item of items) {
    try {
      const payload = item.payload;
      if (payload.type === 'queue') {
        if (!getQueue) {
          throw new Error(`getQueue not configured for queue: ${payload.queueName}`);
        }
        const q = getQueue(payload.queueName);
        await q.add(payload.job.name, payload.job.data, payload.job.opts);
      } else if (payload.type === 'flow') {
        if (!flowProducer) {
          throw new Error('flowProducer not configured for outbox flow item');
        }
        await flowProducer.add(payload.flow);
      } else {
        throw new Error('Unknown outbox payload type');
      }

      await repositories.outbox.markPublished(item.id);
      successCount += 1;
      try {
        getMetrics().outboxEventsPublished.inc({ kind: item.kind });
      } catch {}
      logger?.debug({ id: item.id, kind: item.kind }, 'Outbox item published successfully');
    } catch (err) {
      failureCount += 1;
      await repositories.outbox.recordAttempt(item.id);
      logger?.error(
        { id: item.id, kind: item.kind, err: (err as Error).message },
        'Failed to publish outbox item'
      );
    }
  }

  if (items.length > 0) {
    try {
      const durationSec = (Date.now() - startMs) / 1000;
      getMetrics().outboxDrainDuration.observe(durationSec);
    } catch {}
  }

  return {
    processedCount: items.length,
    successCount,
    failureCount,
  };
}

export class OutboxRelay {
  private timer?: NodeJS.Timeout;
  private running = false;
  private draining = false;

  constructor(private readonly options: OutboxRelayOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    const intervalMs = this.options.intervalMs ?? 1000;

    const loop = async () => {
      if (!this.running) return;
      if (!this.draining) {
        this.draining = true;
        try {
          await drainOutboxOnce(this.options.repositories, {
            getQueue: this.options.getQueue,
            flowProducer: this.options.flowProducer,
            batchSize: this.options.batchSize,
            logger: this.options.logger,
          });
        } catch (err) {
          this.options.logger?.error({ err: (err as Error).message }, 'Outbox relay loop error');
        } finally {
          this.draining = false;
        }
      }
      if (this.running) {
        this.timer = setTimeout(loop, intervalMs);
      }
    };

    loop();
  }

  isRunning(): boolean {
    return this.running;
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
