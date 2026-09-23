import { Adapters } from '@vp/adapters/composition';
import { type Container, token } from '@vp/composition';
import type { JobQueue, QueueJob } from '@vp/core/ports';
import { toPipelineError } from '@vp/errors';
import type { Logger, PipelineMetrics } from '@vp/observability';
import { fromPromise, isErr, ok } from '@vp/result';
import { createFailureHandler } from '../failure-handler';
import { validateQueueName } from '../job-identity';
import { STAGE_REGISTRY, type StageDefinition, type StageProcessor } from '../registry';
import { OutboxRelay } from '../stages/housekeeping/outbox-relay';
import { withTelemetry } from '../with-telemetry';

export interface StageRuntime {
  logger: Logger;
  metrics: PipelineMetrics;
  workerId: string | undefined;
  outboxRelay: { enabled: boolean; intervalMs: number };
}

export interface StageConsumer {
  queue: JobQueue;
  processor: StageProcessor;
}

export const Worker = {
  Stage: token<StageDefinition>('Stage'),
  GetQueue: token<(name: string) => JobQueue>('GetQueue'),
  ConsumeQueue: token<JobQueue>('ConsumeQueue'),
  Consumer: token<StageConsumer>('Consumer'),
  OutboxRelay: token<OutboxRelay | undefined>('OutboxRelay'),
} as const;

/**
 * The one place a stage result becomes a BullMQ outcome: a normal return is a completed job, so a
 * returned failure is raised here, and a flow parent reads its children's plain values (ADR-24).
 */
function instrument(
  stage: StageDefinition,
  processor: StageProcessor,
  metrics: PipelineMetrics
): (job: QueueJob<{ videoId?: string; traceparent?: string }>) => Promise<unknown> {
  const { queue } = stage;

  return withTelemetry(queue, async (job: QueueJob<{ videoId?: string; traceparent?: string }>) => {
    const startTime = Date.now();
    metrics.bullmqQueueJobs.set({ queue, state: 'active' }, 1);

    const enqueuedAt = (job as { timestamp?: number }).timestamp;
    if (enqueuedAt && enqueuedAt > 0) {
      metrics.jobWaitDuration.observe({ queue }, Math.max(0, (startTime - enqueuedAt) / 1000));
    }

    const settled = await fromPromise(
      () => processor(job),
      (cause) => cause
    );
    const failed = isErr(settled) || isErr(settled.value);
    metrics.jobDuration.observe({ queue }, (Date.now() - startTime) / 1000);
    metrics.jobsProcessed.inc({ queue, result: failed ? 'failed' : 'completed' });

    if (isErr(settled)) throw settled.error;
    if (isErr(settled.value)) throw toPipelineError(settled.value.error);
    return settled.value.value;
  });
}

export function registerStages(c: Container, runtime: StageRuntime): Container {
  return c
    .provide(Worker.Stage, (c) => {
      const stage = STAGE_REGISTRY[c.get(Adapters.Config).worker.stage];
      validateQueueName(stage.queue);
      return stage;
    })
    .provide(Worker.GetQueue, (c) => {
      const registry = c.get(Adapters.QueueRegistry);
      return (name) => registry.get(name);
    })
    .provide(Worker.ConsumeQueue, (c) => c.get(Worker.GetQueue)(c.get(Worker.Stage).queue))
    .provide(
      Worker.Consumer,
      (c) => ({
        queue: c.get(Worker.ConsumeQueue),
        processor: c.get(Worker.Stage).createProcessor({
          config: c.get(Adapters.Config),
          repositories: c.get(Adapters.Repositories),
          storage: c.get(Adapters.Storage),
          multipart: c.get(Adapters.Multipart),
          cache: c.get(Adapters.Cache),
          getQueue: c.get(Worker.GetQueue),
          flowProducer: c.get(Adapters.FlowProducer),
          logger: runtime.logger,
          workerId: runtime.workerId,
        }),
      }),
      {
        start: async ({ queue, processor }) => {
          const stage = c.get(Worker.Stage);
          queue.onFailed?.(
            createFailureHandler({
              stage: stage.stage,
              queueName: stage.queue,
              repositories: c.get(Adapters.Repositories),
              getQueue: c.get(Worker.GetQueue),
              logger: runtime.logger,
              metrics: runtime.metrics,
              workerId: runtime.workerId,
            })
          );
          return queue.process(
            instrument(stage, processor, runtime.metrics) as Parameters<JobQueue['process']>[0],
            {
              concurrency: c.get(Adapters.Config).worker.concurrency ?? stage.concurrency,
              lockDurationMs: stage.lockDurationMs,
              lockRenewTimeMs: stage.lockRenewTimeMs,
              stalledIntervalMs: stage.stalledIntervalMs,
              maxStalledCount: stage.maxStalledCount,
            }
          );
        },
      }
    )
    .provide(
      Worker.OutboxRelay,
      (c) =>
        c.get(Worker.Stage).stage === 'housekeeping' && runtime.outboxRelay.enabled
          ? new OutboxRelay({
              repositories: c.get(Adapters.Repositories),
              getQueue: c.get(Worker.GetQueue),
              flowProducer: c.get(Adapters.FlowProducer),
              logger: runtime.logger,
              metrics: runtime.metrics,
              intervalMs: runtime.outboxRelay.intervalMs,
            })
          : undefined,
      {
        start: async (relay) => {
          relay?.start();
          return ok();
        },
        dispose: (relay) => relay?.stop(),
      }
    );
}
