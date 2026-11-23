import { z } from 'zod';
import { defaultJobOptions, stagePolicies } from './policies';

/**
 * Rides the `transcode-1080p` queue: a render is one long ffmpeg run per rendition, and that pod already
 * has the tools, the lock length and the shutdown grace for it. One job renders a replacement's upload or
 * an edit of the base generation into a new generation, then swaps it in.
 */
export const APPLY_EDITS = 'apply-edits';
const APPLY_EDITS_QUEUE = 'transcode-1080p';

export const ApplyEditsJob = z.object({
  videoId: z.uuid(),
  generation: z.number().int().min(2),
  traceparent: z.string(),
  requestId: z.string().optional(),
});
export type ApplyEditsJob = z.infer<typeof ApplyEditsJob>;

/** The outbox row that queues the render once its generation commits; one job per generation. */
export const applyEditsOutbox = (job: ApplyEditsJob) =>
  ({
    kind: APPLY_EDITS,
    payload: {
      type: 'queue',
      queueName: APPLY_EDITS_QUEUE,
      job: {
        name: APPLY_EDITS,
        data: job,
        opts: {
          jobId: `${job.videoId}--${APPLY_EDITS}--g${job.generation}`,
          ...stagePolicies[APPLY_EDITS_QUEUE],
          ...defaultJobOptions,
        },
      },
    },
  }) as const;
