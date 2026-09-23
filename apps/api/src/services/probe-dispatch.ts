import type { JobQueue, QueueJobOptions } from '@vp/core/ports';
import type { NewOutboxInput } from '@vp/core/repositories';
import type { QueueUnavailable } from '@vp/errors';
import { ProbeJob, defaultJobOptions, ids, stagePolicies } from '@vp/job-contracts';
import { type Result, map, ok } from '@vp/result';

const PROBE_QUEUE = 'probe';

export interface ProbeDispatchInput {
  videoId: string;
  sourceKey: string;
  generation: number;
  traceparent: string;
  priority?: number;
}

export interface ProbeDispatch {
  data: ProbeJob;
  opts: QueueJobOptions;
  outbox: NewOutboxInput;
}

/**
 * Both entry points into the probe stage — first upload completion and later
 * reprocess — must commit the same job to the outbox that they later enqueue
 * directly, or the relay publishes a job the fast path already published under
 * a different id.
 */
export function buildProbeDispatch(input: ProbeDispatchInput): ProbeDispatch {
  const data = ProbeJob.parse({
    videoId: input.videoId,
    sourceKey: input.sourceKey,
    generation: input.generation,
    traceparent: input.traceparent,
  });

  const opts: QueueJobOptions = {
    jobId: ids.probe(input.videoId, input.generation),
    ...stagePolicies.probe,
    ...defaultJobOptions,
    ...(input.priority === undefined ? {} : { priority: input.priority }),
  };

  return {
    data,
    opts,
    outbox: {
      kind: PROBE_QUEUE,
      payload: {
        type: 'queue',
        queueName: PROBE_QUEUE,
        job: { name: PROBE_QUEUE, data, opts },
      },
    },
  };
}

/** A deployment with no probe queue wired has nothing to enqueue, which is not a failure. */
export async function enqueueProbe(
  queue: JobQueue | undefined,
  dispatch: ProbeDispatch
): Promise<Result<void, QueueUnavailable>> {
  if (!queue) return ok();
  return map(await queue.add(PROBE_QUEUE, dispatch.data, dispatch.opts), () => undefined);
}
