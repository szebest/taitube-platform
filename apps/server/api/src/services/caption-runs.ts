import type {
  CaptionCommit,
  CaptionRecord,
  CaptionRepository,
  OutboxRepository,
} from '@vp/core/repositories';
import type { CaptionTrack, Video } from '@vp/domain';
import type { CaptionsConfig } from '@vp/env-schema';
import { type DatabaseUnavailable, type VersionConflict, versionConflict } from '@vp/errors';
import { captionsFlow } from '@vp/job-contracts';
import { createTraceparent, getActiveTraceparent } from '@vp/observability';
import { type Result, andThen, err, ignore, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { DispatchOrigin } from './probe-dispatch';

export interface CaptionRunDeps {
  captions: CaptionRepository;
  outbox: OutboxRepository;
  settings: Pick<CaptionsConfig, 'enabled' | 'modelVersion'>;
}

export type CaptionRunFailure = DatabaseUnavailable | VersionConflict;

/** A write landed on the version it was asked against, or the track moved on under it. */
export function committed(
  commit: CaptionCommit,
  captionId: string,
  expectedVersion?: number
): Result<CaptionRecord, VersionConflict> {
  return commit.type === 'committed'
    ? ok(commit.track)
    : err(versionConflict(captionId, expectedVersion));
}

/**
 * Puts the generated track back to `pending` (or creates it) and enqueues its run through the
 * outbox. No run is enqueued while captions are switched off for the platform, nor for a video
 * probe has not measured yet: the worker's `reconcile-captions` task and probe start those, and a
 * lost enqueue is recovered the same way.
 */
export async function startCaptionRun(
  deps: CaptionRunDeps,
  video: Video,
  replaced: CaptionTrack | null,
  language: string | null,
  origin: DispatchOrigin
): Promise<Result<CaptionRecord, CaptionRunFailure>> {
  const { modelVersion, enabled } = deps.settings;
  const written: Result<CaptionRecord, CaptionRunFailure> = replaced
    ? andThen(
        await deps.captions.regenerate({
          id: replaced.id,
          expectedVersion: replaced.version,
          modelVersion,
          language,
        }),
        (commit) => committed(commit, replaced.id, replaced.version)
      )
    : await deps.captions.createGenerated({
        id: uuidv7(),
        videoId: video.id,
        language,
        modelVersion,
        status: 'pending',
        reason: null,
      });
  if (isErr(written)) return written;

  const track = written.value;
  if (enabled && video.durationMs && track.status === 'pending') {
    const flow = captionsFlow({
      videoId: video.id,
      captionId: track.id,
      captionVersion: track.version,
      sourceKey: video.sourceKey,
      durationMs: video.durationMs,
      modelVersion,
      language: track.language,
      traceparent: getActiveTraceparent() ?? createTraceparent(),
      requestId: origin.requestId,
    });
    ignore(
      await deps.outbox.enqueue({ kind: 'captions', payload: { type: 'flow', flow } }),
      'reconcile-captions re-enqueues a pending track whose run was never queued'
    );
  }
  return written;
}
