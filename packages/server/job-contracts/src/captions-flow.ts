import { captionsWindowCountFor } from './chunks';
import { type CaptionsJob, ids } from './index';
import { defaultJobOptions, stagePolicies } from './policies';

export type CaptionsRun = Omit<CaptionsJob, 'plan'>;

/** The shape `FlowProducerPort.add` takes, restated so this package needs nothing from `@vp/core`. */
export interface CaptionsFlowNode {
  name: 'captions';
  queueName: 'captions';
  data: CaptionsJob;
  opts: typeof stagePolicies.captions &
    typeof defaultJobOptions & { jobId: string; failParentOnFailure?: boolean };
  children?: CaptionsFlowNode[];
}

const QUEUE = 'captions';

/**
 * One captions run as one flow on the `captions` queue alone: a short source is a single job, a long
 * one a merge parent over one child per window. It is never a child of `package`, so `READY` never
 * waits for it. Probe, the API and the reconciler all enqueue through here, so a run has one id.
 */
export function captionsFlow(run: CaptionsRun): CaptionsFlowNode {
  const { videoId, modelVersion, captionVersion } = run;
  const opts = { ...stagePolicies.captions, ...defaultJobOptions };
  const windowCount = captionsWindowCountFor(run.durationMs);
  const jobId = ids.captions(videoId, modelVersion, captionVersion);

  if (windowCount === undefined) {
    return {
      name: QUEUE,
      queueName: QUEUE,
      data: { ...run, plan: { type: 'single' } },
      opts: { ...opts, jobId },
    };
  }

  return {
    name: QUEUE,
    queueName: QUEUE,
    data: { ...run, plan: { type: 'merge', windowCount } },
    opts: { ...opts, jobId },
    children: Array.from({ length: windowCount }, (_, index) => ({
      name: QUEUE,
      queueName: QUEUE,
      data: { ...run, plan: { type: 'window', index, windowCount } },
      opts: {
        ...opts,
        jobId: ids.captionsChunk(videoId, modelVersion, captionVersion, index),
        failParentOnFailure: true,
      },
    })),
  };
}
