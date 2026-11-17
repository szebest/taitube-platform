import { type Result, err, isErr, ok } from '@kit/result';
import type { JobQueue } from '@vp/core/ports';
import type { StepRepository, VideoRepository } from '@vp/core/repositories';
import {
  type VideoLifecycleFailure,
  decideVideoDelete,
  decideVideoReprocess,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import { createTraceparent, getActiveTraceparent } from '@vp/observability';
import type { UserContext } from '@vp/permissions';
import { type DispatchOrigin, buildProbeDispatch, enqueueProbe } from './probe-dispatch';

export interface VideoLifecycleDeps {
  videos: VideoRepository;
  steps: StepRepository;
  probeQueue: JobQueue;
}

export interface ReprocessResult {
  videoId: string;
  status: 'PROBING';
  generation: number;
}

export interface SoftDeleteResult {
  videoId: string;
  status: 'DELETED';
}

export type VideoLifecycleServiceFailure =
  | VideoLifecycleFailure
  | VersionConflict
  | DatabaseUnavailable;

/**
 * Re-runs the pipeline for an existing source under a fresh generation (SDD §6.3). The generation
 * bump is what keeps the new probe job id distinct from the one the first run already consumed.
 * The steps are reset before the transition: once it commits, the outbox may start the new probe,
 * which a step the old run left DONE would fence.
 */
export async function reprocessVideo(
  deps: VideoLifecycleDeps,
  user: UserContext,
  videoId: string,
  origin: DispatchOrigin = {}
): Promise<Result<ReprocessResult, VideoLifecycleServiceFailure>> {
  const found = await deps.videos.findById(videoId);
  if (isErr(found)) return found;

  const decided = decideVideoReprocess({ actor: user, video: found.value, videoId });
  if (isErr(decided)) return decided;

  const generation = (decided.value.generation || 1) + 1;
  const dispatch = buildProbeDispatch({
    videoId,
    sourceKey: decided.value.sourceKey,
    generation,
    traceparent: getActiveTraceparent() ?? createTraceparent(),
    requestId: origin.requestId,
  });

  const reset = await deps.steps.reset(videoId);
  if (isErr(reset)) return reset;

  const transitioned = await deps.videos.transition({
    videoId,
    edge: 'reprocess',
    eventPayload: { generation, requestedBy: user.id },
    patch: { generation, errorCode: null, errorMessage: null },
    outbox: dispatch.outbox,
  });
  if (isErr(transitioned)) return transitioned;
  if (!transitioned.value) return err(versionConflict(videoId));

  await enqueueProbe(deps.probeQueue, dispatch);

  return ok({ videoId, status: 'PROBING', generation });
}

/** Soft deletes a video (SDD §6.1, §9.8). Deleting an already-deleted video is a no-op, not a failure. */
export async function softDeleteVideo(
  deps: VideoLifecycleDeps,
  user: UserContext,
  videoId: string
): Promise<Result<SoftDeleteResult, VideoLifecycleServiceFailure>> {
  const found = await deps.videos.findById(videoId);
  if (isErr(found)) return found;

  if (found.value?.status === 'DELETED') return ok({ videoId, status: 'DELETED' });

  const decided = decideVideoDelete({ actor: user, video: found.value, videoId });
  if (isErr(decided)) return decided;

  const transitioned = await deps.videos.transition({
    videoId,
    edge: 'delete',
    eventPayload: { requestedBy: user.id },
    patch: { deletedAt: new Date() },
  });
  if (isErr(transitioned)) return transitioned;
  if (!transitioned.value) return err(versionConflict(videoId));

  return ok({ videoId, status: 'DELETED' });
}
