import { Adapters } from '@vp/adapters/composition';
import { type Container, token } from '@vp/composition';
import type { JobQueue, QueueJob } from '@vp/core/ports';
import { toPipelineError } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import type { LogContext, Logger } from '@vp/logger';
import { MetricsServer, type PipelineMetrics } from '@vp/observability';
import { fromPromise, isErr, isOk, ok } from '@vp/result';
import { createFailureHandler } from '../failure-handler';
import { Heartbeat, everyInterval } from '../heartbeat';
import { validateJobId, validateQueueName } from '../job-identity';
import { STAGE_REGISTRY, type StageDefinition, type StageProcessor } from '../registry';
import { housekeepingTasks } from '../stages/housekeeping/index';
import { OutboxRelay } from '../stages/housekeeping/outbox-relay';
import { withTelemetry } from '../with-telemetry';

export interface StageRuntime {
  logger: Logger;
  logContext: LogContext;
  workerId: string;
  media: MediaTools;
  outboxRelay: { enabled: boolean };
}

export interface StageConsumer {
  queue: JobQueue;
  processor: StageProcessor;
}

export const Worker = {
  Stage: token<StageDefinition>('Stage'),
  GetQueue: token<(name: string) => JobQueue>('GetQueue'),
  ConsumeQueue: token<JobQueue>('ConsumeQueue'),
  MetricsServer: token<MetricsServer>('MetricsServer'),
  Heartbeat: token<Heartbeat>('Heartbeat'),
  Consumer: token<StageConsumer>('Consumer'),
  OutboxRelay: token<OutboxRelay | undefined>('OutboxRelay'),
} as const;

/**
 * The order `start()` runs them in, which is the order they are resolved: the scrape endpoint and
 * the liveness file exist before the first job is taken, so no job runs without either.
 */
export function resolveStartOrder(c: Container): void {
  c.get(Worker.MetricsServer);
  c.get(Worker.Heartbeat);
  c.get(Worker.Consumer);
  c.get(Worker.OutboxRelay);
}

/**
 * The one place a stage result becomes a BullMQ outcome: a normal return is a completed job, so a
 * returned failure is raised here, and a flow parent reads its children's plain values (ADR-24).
 */
type TracedJob = QueueJob<{ videoId?: string; traceparent?: string; requestId?: string }>;

function instrument(
  stage: StageDefinition,
  processor: StageProcessor,
  metrics: PipelineMetrics,
  logContext: LogContext
): (job: TracedJob) => Promise<unknown> {
  const { queue } = stage;

  const traced = withTelemetry(queue, async (job: TracedJob) => {
    const startTime = Date.now();

    if (job.enqueuedAt !== undefined) {
      const waitedSeconds = Math.max(0, (startTime - job.enqueuedAt) / 1000);
      metrics.jobWaitDuration.observe({ queue }, waitedSeconds);
    }

    const identified = validateJobId(job.id);
    if (isErr(identified)) throw toPipelineError(identified.error);

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

  return (job) => {
    const { requestId } = job.data ?? {};
    return logContext.run(requestId ? { requestId } : {}, () => traced(job));
  };
}

export function registerStages(c: Container, runtime: StageRuntime): Container {
  const config = () => c.get(Adapters.Config);

  return c
    .provide(Worker.Stage, () => {
      const stage = STAGE_REGISTRY[config().worker.stage];
      validateQueueName(stage.queue);
      return stage;
    })
    .provide(Worker.GetQueue, (c) => {
      const registry = c.get(Adapters.QueueRegistry);
      return (name) => registry.get(name);
    })
    .provide(Worker.ConsumeQueue, (c) => c.get(Worker.GetQueue)(c.get(Worker.Stage).queue))
    .provide(
      Worker.MetricsServer,
      (c) => {
        const queue = c.get(Worker.ConsumeQueue);
        return new MetricsServer({
          port: config().http.metricsPort,
          host: '0.0.0.0',
          registry: c.get(Adapters.Metrics).registry,
          ready: async () => isOk(await queue.checkHealth()),
        });
      },
      { start: (server) => server.listen(), dispose: (server) => server.close() }
    )
    .provide(
      Worker.Heartbeat,
      () =>
        new Heartbeat({
          path: config().worker.heartbeatPath,
          intervalMs: config().worker.heartbeatIntervalMs,
          now: Date.now,
          every: everyInterval,
        }),
      { start: (heartbeat) => heartbeat.start(), dispose: (heartbeat) => heartbeat.stop() }
    )
    .provide(
      Worker.Consumer,
      (c) => ({
        queue: c.get(Worker.ConsumeQueue),
        processor: c.get(Worker.Stage).createProcessor({
          config: config(),
          repositories: c.get(Adapters.Repositories),
          storage: c.get(Adapters.Storage),
          multipart: c.get(Adapters.Multipart),
          cache: c.get(Adapters.Cache),
          reactionCache: c.get(Adapters.ReactionCache),
          viewBuffer: c.get(Adapters.ViewBuffer),
          getQueue: c.get(Worker.GetQueue),
          flowProducer: c.get(Adapters.FlowProducer),
          logger: runtime.logger,
          metrics: c.get(Adapters.Metrics),
          media: runtime.media,
          workerId: runtime.workerId,
          now: Date.now,
          every: everyInterval,
        }),
      }),
      {
        start: async ({ queue, processor }) => {
          const stage = c.get(Worker.Stage);
          const metrics = c.get(Adapters.Metrics);
          queue.onStalled?.(() =>
            metrics.jobsProcessed.inc({ queue: stage.queue, result: 'stalled' })
          );
          queue.onFailed?.(
            createFailureHandler({
              stage: stage.stage,
              queueName: stage.queue,
              repositories: c.get(Adapters.Repositories),
              getQueue: c.get(Worker.GetQueue),
              logger: runtime.logger,
              metrics,
              workerId: runtime.workerId,
            })
          );
          return queue.process(
            instrument(stage, processor, metrics, runtime.logContext) as Parameters<
              JobQueue['process']
            >[0],
            {
              concurrency: config().worker.concurrency ?? stage.concurrency,
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
              metrics: c.get(Adapters.Metrics),
              every: everyInterval,
              ...housekeepingTasks(config().housekeeping).outbox,
            })
          : undefined,
      {
        start: async (relay) => {
          void relay?.start();
          return ok();
        },
        dispose: (relay) => relay?.stop(),
      }
    );
}
