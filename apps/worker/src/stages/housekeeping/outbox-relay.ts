import type { FlowProducerPort, JobQueue } from '@vp/core/ports';
import type { OutboxPayload, Repositories } from '@vp/core/repositories';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type Failure,
  type QueueUnavailable,
} from '@vp/errors';
import { type Logger, type PipelineMetrics, getMetrics } from '@vp/observability';
import { type Result, err, isErr, map, ok } from '@vp/result';

export interface OutboxRelayOptions {
  repositories: Repositories;
  getQueue?: (name: string) => JobQueue;
  flowProducer?: FlowProducerPort;
  batchSize: number;
  intervalMs: number;
  logger?: Logger;
  metrics?: PipelineMetrics;
}

export interface DrainOutboxResult {
  processedCount: number;
  successCount: number;
  failureCount: number;
}

/** A payload naming a transport this relay was not wired with. Configuration, not a dead queue. */
type RelayNotConfigured = Failure<typeof ErrorCodes.INTERNAL, { payloadType: string }>;

function relayNotConfigured(payloadType: string): RelayNotConfigured {
  return {
    code: ErrorCodes.INTERNAL,
    message: `Outbox relay has no transport configured for a "${payloadType}" payload`,
    payloadType,
  };
}

async function publish(
  payload: OutboxPayload,
  getQueue: ((name: string) => JobQueue) | undefined,
  flowProducer: FlowProducerPort | undefined
): Promise<Result<void, RelayNotConfigured | QueueUnavailable>> {
  if (payload.type === 'queue') {
    if (!getQueue) return err(relayNotConfigured('queue'));
    const queue = getQueue(payload.queueName);
    return map(
      await queue.add(payload.job.name, payload.job.data, payload.job.opts),
      () => undefined
    );
  }

  if (!flowProducer) return err(relayNotConfigured('flow'));
  return map(await flowProducer.add(payload.flow), () => undefined);
}

export async function drainOutboxOnce(
  repositories: Repositories,
  options: {
    getQueue?: (name: string) => JobQueue;
    flowProducer?: FlowProducerPort;
    batchSize: number;
    logger?: Logger;
  }
): Promise<Result<DrainOutboxResult, DatabaseUnavailable>> {
  const { getQueue, flowProducer, batchSize, logger } = options;
  const startMs = Date.now();
  const claimed = await repositories.outbox.claimBatch(batchSize);
  if (isErr(claimed)) return claimed;

  const items = claimed.value;
  let successCount = 0;
  let failureCount = 0;

  for (const item of items) {
    const published = await publish(item.payload, getQueue, flowProducer);

    if (isErr(published)) {
      failureCount += 1;
      const recorded = await repositories.outbox.recordAttempt(item.id);
      if (isErr(recorded)) return recorded;
      logger?.error(
        { id: item.id, kind: item.kind, code: published.error.code },
        'Failed to publish outbox item'
      );
      continue;
    }

    const marked = await repositories.outbox.markPublished(item.id);
    if (isErr(marked)) return marked;

    successCount += 1;
    getMetrics().outboxEventsPublished.inc({ kind: item.kind });
    logger?.debug({ id: item.id, kind: item.kind }, 'Outbox item published successfully');
  }

  if (items.length > 0) {
    getMetrics().outboxDrainDuration.observe((Date.now() - startMs) / 1000);
  }

  return ok({ processedCount: items.length, successCount, failureCount });
}

export class OutboxRelay {
  private timer?: NodeJS.Timeout;
  private running = false;
  private draining = false;

  constructor(private readonly options: OutboxRelayOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    const { intervalMs } = this.options;

    const loop = async () => {
      if (!this.running) return;
      if (!this.draining) {
        this.draining = true;
        // A drain that could not read the outbox leaves the rows claimed for the next tick; the
        // loop must keep ticking, so its failure is reported and dropped rather than returned.
        const drained = await drainOutboxOnce(this.options.repositories, {
          getQueue: this.options.getQueue,
          flowProducer: this.options.flowProducer,
          batchSize: this.options.batchSize,
          logger: this.options.logger,
        });
        if (isErr(drained)) {
          this.options.logger?.error({ code: drained.error.code }, 'Outbox relay loop error');
        }
        this.draining = false;
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
