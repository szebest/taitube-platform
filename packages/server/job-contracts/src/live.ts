import { z } from 'zod';
import { defaultJobOptions, stagePolicies } from './policies';

const QUEUE = 'live';

/** One job per broadcast: it packages the ingest for as long as the publisher sends. */
export const LiveJob = z.object({
  liveStreamId: z.uuid(),
  videoId: z.uuid(),
  traceparent: z.string().optional(),
  requestId: z.string().optional(),
});
export type LiveJob = z.infer<typeof LiveJob>;

const liveJobId = (liveStreamId: string) => `${liveStreamId}--live`;

/** The outbox row going live commits, so the packager starts exactly once per broadcast. */
export function liveOutbox(job: LiveJob) {
  return {
    kind: QUEUE,
    payload: {
      type: 'queue',
      queueName: QUEUE,
      job: {
        name: QUEUE,
        data: job,
        opts: { jobId: liveJobId(job.liveStreamId), ...stagePolicies.live, ...defaultJobOptions },
      },
    },
  } as const;
}
