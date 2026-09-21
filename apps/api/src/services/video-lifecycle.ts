import type { AuthorizationPort, JobQueue, VideoRepository, VideoStatus } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { createTraceparent, getActiveTraceparent } from '@vp/observability';
import { canDeleteVideo, canUpdateVideo } from '@vp/permissions';
import type { AuthUser } from '../plugins/auth';
import { buildProbeDispatch, enqueueProbe } from './probe-dispatch';

export const REPROCESSABLE_STATUSES: VideoStatus[] = ['READY', 'FAILED', 'PROCESSING'];

export const DELETABLE_STATUSES: VideoStatus[] = [
  'UPLOADING',
  'UPLOADED',
  'PROBING',
  'PROCESSING',
  'READY',
  'FAILED',
  'REJECTED',
  'ABANDONED',
];

export interface VideoLifecycleDeps {
  videos: VideoRepository;
  auth: AuthorizationPort;
  probeQueue?: JobQueue;
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

/**
 * Re-runs the pipeline for an existing source under a fresh generation (SDD §6.3).
 * The generation bump is what keeps the new probe job id distinct from the one
 * the first run already consumed.
 */
export async function reprocessVideo(
  deps: VideoLifecycleDeps,
  user: AuthUser,
  videoId: string,
  options: { traceparent?: string } = {}
): Promise<ReprocessResult> {
  const video = await deps.videos.findById(videoId);
  if (!video) throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

  deps.auth.assertCan(
    canUpdateVideo,
    { user: user, video },
    {
      action: 'update',
      subject: 'Video',
      message: 'Only the video owner or an admin may reprocess this video',
    }
  );

  if (!REPROCESSABLE_STATUSES.includes(video.status)) {
    throw new PermanentError(
      ErrorCodes.VALIDATION_FAILED,
      `Cannot reprocess video with status ${video.status}. Must be ${REPROCESSABLE_STATUSES.join(', ')}.`
    );
  }

  const generation = (video.generation || 1) + 1;
  const dispatch = buildProbeDispatch({
    videoId,
    sourceKey: video.sourceKey,
    generation,
    traceparent: options.traceparent || getActiveTraceparent() || createTraceparent(),
  });

  const transitioned = await deps.videos.transition({
    videoId,
    from: REPROCESSABLE_STATUSES,
    to: 'PROBING',
    eventType: 'video.reprocessing',
    eventPayload: { generation, requestedBy: user.id },
    patch: { generation, errorCode: null, errorMessage: null },
    outbox: dispatch.outbox,
  });

  if (!transitioned) {
    throw new PermanentError(
      ErrorCodes.VERSION_CONFLICT,
      'State conflict while transitioning video to PROBING for reprocess'
    );
  }

  await enqueueProbe(deps.probeQueue, dispatch);

  return { videoId, status: 'PROBING', generation };
}

/**
 * Soft deletes a video (SDD §6.1, §9.8, Ticket 17 AC 4).
 */
export async function softDeleteVideo(
  deps: VideoLifecycleDeps,
  user: AuthUser,
  videoId: string
): Promise<SoftDeleteResult> {
  const video = await deps.videos.findById(videoId);
  if (!video) throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);

  deps.auth.assertCan(
    canDeleteVideo,
    { user: user, video },
    {
      action: 'delete',
      subject: 'Video',
      message: 'Only the video owner or an admin may delete this video',
    }
  );

  if (video.status === 'DELETED') return { videoId, status: 'DELETED' };

  const transitioned = await deps.videos.transition({
    videoId,
    from: DELETABLE_STATUSES,
    to: 'DELETED',
    eventType: 'video.deleted',
    eventPayload: { requestedBy: user.id },
    patch: { deletedAt: new Date() },
  });

  if (!transitioned) {
    throw new PermanentError(
      ErrorCodes.VERSION_CONFLICT,
      'State conflict while transitioning video to DELETED'
    );
  }

  return { videoId, status: 'DELETED' };
}
