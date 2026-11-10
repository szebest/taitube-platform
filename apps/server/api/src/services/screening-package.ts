import type { JobQueue, QueueJobOptions } from '@vp/core/ports';
import type { NewOutboxInput, VideoRecord } from '@vp/core/repositories';
import {
  LadderEntry,
  type PackageJob,
  defaultJobOptions,
  ids,
  stagePolicies,
} from '@vp/job-contracts';
import { ignore } from '@vp/result';
import { z } from 'zod';

const PACKAGE_QUEUE = 'package';

export interface PackageDispatch {
  data: PackageJob;
  opts: QueueJobOptions;
  outbox: NewOutboxInput;
}

/**
 * The `package` job that writes the master of an approved video. Its renditions are already in storage,
 * so the job runs alone, without the flow it was first a parent of; `screened` makes it look the
 * approval up. `null` for a video that never recorded its ladder, which has nothing to package.
 */
export function buildApprovedPackageDispatch(
  video: Pick<VideoRecord, 'id' | 'generation' | 'ladder'>,
  traceparent: string
): PackageDispatch | null {
  const ladder = z.array(LadderEntry).min(1).safeParse(video.ladder);
  if (!ladder.success) return null;

  const data: PackageJob = {
    videoId: video.id,
    generation: video.generation,
    traceparent,
    ladder: ladder.data,
    screened: true,
  };
  const opts: QueueJobOptions = {
    jobId: ids.packageApproved(video.id, video.generation),
    ...stagePolicies.package,
    ...defaultJobOptions,
  };

  return {
    data,
    opts,
    outbox: {
      kind: PACKAGE_QUEUE,
      payload: {
        type: 'queue',
        queueName: PACKAGE_QUEUE,
        job: { name: PACKAGE_QUEUE, data, opts },
      },
    },
  };
}

/** The fast path only: the outbox row committed with the approval is the delivery. */
export async function enqueueApprovedPackage(
  queue: JobQueue,
  dispatch: PackageDispatch
): Promise<void> {
  ignore(
    await queue.add(PACKAGE_QUEUE, dispatch.data, dispatch.opts),
    'the outbox row committed with the approval delivers the package job if this fast path fails'
  );
}
