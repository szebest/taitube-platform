import * as path from 'node:path';
import type { FrameClassifier, QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { ScreeningFinding } from '@vp/domain';
import { decideScreening } from '@vp/domain-rules';
import { MS_PER_SECOND } from '@vp/domain/time';
import type { ScreeningConfig } from '@vp/env-schema';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type MediaFailure,
  type StorageUnavailable,
  mediaFailure,
} from '@vp/errors';
import type { FfmpegProcessLimits } from '@vp/ffmpeg';
import type { FingerprintTools } from '@vp/fingerprint';
import type { ScreenJob, ScreenResult } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import type { PipelineMetrics } from '@vp/observability';
import { type Result, err, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import type { Every } from '../../heartbeat';
import { createScratchDir, removeScratchDir } from '../scratch-dir';
import { stepLease } from '../step-lease';
import { contentFindings } from './content-findings';
import { fingerprintFindings } from './fingerprint-findings';
import { metadataFinding } from './metadata-finding';
import { toScreenResult } from './screen-result';

export interface ScreenProcessorDeps {
  repositories: Repositories;
  storage: StorageClient;
  fingerprint: FingerprintTools;
  classifier: FrameClassifier;
  metrics: PipelineMetrics;
  rawBucket: string;
  workerId: string;
  logger: Logger;
  tmpDir: string;
  ffmpegPath: string;
  fpcalcPath: string;
  ffmpegProcess: FfmpegProcessLimits;
  screening: Pick<ScreeningConfig, 'thresholds' | 'sampling' | 'process'>;
  now: () => number;
  every: Every;
}

export type ScreenStageFailure = MediaFailure | StorageUnavailable | DatabaseUnavailable;

const NO_REASON = 'none';

/**
 * Screens one source: fingerprints it against the catalogue, scores its frames, reads its text, and
 * stores the verdict keyed by the video and the source's checksum, so a re-run or a re-process of the
 * same source gets the stored result back. The stage never holds a video itself; `package` reads the
 * result and makes the transition.
 */
export function createScreenProcessor(deps: ScreenProcessorDeps) {
  const { repositories, storage, metrics, rawBucket, workerId, logger, tmpDir: tmpRoot } = deps;
  const { thresholds } = deps.screening;

  return async function processScreenJob(
    job: QueueJob<ScreenJob>
  ): Promise<Result<ScreenResult, ScreenStageFailure>> {
    const { videoId, sourceKey, durationMs, hasAudio } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const log = logger.child({ videoId, jobId: job.id, stage: 'screen', attempt });
    const startedAt = deps.now();

    const lockToken = uuidv7();
    const claim = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'screen',
      rendition: '-',
      jobId: job.id || '',
      attempt,
      workerId,
      lockToken,
    });
    if (isErr(claim)) return claim;

    if (claim.value.fenced) {
      log.warn({ lockToken }, 'screen step already completed; fenced out');
      const stored = await repositories.screenings.latestForVideo(videoId);
      if (isErr(stored)) return stored;
      return stored.value
        ? ok(toScreenResult(stored.value))
        : err(mediaFailure('screen', ErrorCodes.ORPHANED, 'A completed screen step has no result'));
    }

    const lease = stepLease(repositories.steps, lockToken);
    lease.renew(true);

    /** One place records how a screen ended badly, so every exit reports the same way. */
    const failScreen = async (
      failure: ScreenStageFailure
    ): Promise<Result<never, ScreenStageFailure>> => {
      log.error({ err: failure }, 'screen job failed');
      const recorded = await repositories.steps.fail({
        videoId,
        step: 'screen',
        rendition: '-',
        lockToken,
        errorCode: failure.code,
        errorMessage: failure.message,
      });
      return isErr(recorded) ? recorded : err(failure);
    };

    const found = await repositories.videos.findById(videoId);
    if (isErr(found)) return found;
    const video = found.value;
    if (!video || video.deletedAt) {
      return failScreen(mediaFailure('screen', ErrorCodes.ORPHANED, `Video ${videoId} is gone`));
    }

    const head = await storage.headObject(rawBucket, sourceKey);
    if (isErr(head)) return head;
    if (!head.value) {
      return failScreen(
        mediaFailure('screen', ErrorCodes.SOURCE_MISSING, `Source object not found at ${sourceKey}`)
      );
    }
    const sourceChecksum =
      head.value.etag?.replaceAll('"', '') ?? `size-${head.value.contentLength}`;

    const completeStep = async (
      result: ScreenResult
    ): Promise<Result<ScreenResult, ScreenStageFailure>> => {
      await lease.settled();
      const completed = await repositories.steps.complete({
        videoId,
        step: 'screen',
        rendition: '-',
        lockToken,
        result,
      });
      if (isErr(completed)) return completed;
      if (completed.value.fenced) {
        log.warn({ lockToken, event: 'FENCED_OUT' }, 'fenced out on screen completion; discarding');
      }
      return ok(result);
    };

    const earlier = await repositories.screenings.findByVideo(videoId, sourceChecksum);
    if (isErr(earlier)) return earlier;
    if (earlier.value) {
      log.info(
        { screeningId: earlier.value.id },
        'source already screened; reusing the stored result'
      );
      return completeStep(toScreenResult(earlier.value));
    }

    const scratch = await createScratchDir(tmpRoot, `vp-screen-${videoId}-`);
    const keepAlive = deps.every(deps.screening.process.leaseRenewMs, async () =>
      lease.renew(true)
    );
    try {
      const sourcePath = path.join(scratch, path.basename(sourceKey));
      const downloaded = await storage.downloadObject(rawBucket, sourceKey, sourcePath);
      if (isErr(downloaded)) return downloaded;
      if (!downloaded.value) {
        return failScreen(
          mediaFailure('screen', ErrorCodes.SOURCE_MISSING, `Failed to download ${sourceKey}`)
        );
      }
      lease.renew(true);

      const input = { videoId, sourcePath, durationMs, signal: lease.signal };
      const limits = deps.ffmpegProcess;
      const media = { ffmpegPath: deps.ffmpegPath, limits, screening: deps.screening };

      const fingerprinted = await fingerprintFindings(
        {
          ...media,
          repositories,
          fingerprint: deps.fingerprint,
          fpcalcPath: deps.fpcalcPath,
        },
        { ...input, ownerId: video.ownerId, hasAudio }
      );
      if (isErr(fingerprinted)) return failScreen(fingerprinted.error);
      lease.renew(true);

      const content = await contentFindings(
        {
          ...media,
          storage,
          classifier: deps.classifier,
          fingerprint: deps.fingerprint,
          rawBucket,
        },
        input
      );
      if (isErr(content)) return failScreen(content.error);

      const metadata = await metadataFinding(
        repositories.videos,
        video,
        thresholds,
        deps.screening.process
      );
      if (isErr(metadata)) return metadata;

      const findings: ScreeningFinding[] = [
        ...fingerprinted.value,
        ...content.value,
        ...(metadata.value ? [metadata.value] : []),
      ];
      const verdict = decideScreening(findings, thresholds);
      if (isErr(verdict)) {
        return failScreen(
          mediaFailure('screen', ErrorCodes.SCREEN_MODEL_FAILED, verdict.error.message)
        );
      }

      const recorded = await repositories.screenings.record({
        id: uuidv7(),
        videoId,
        sourceChecksum,
        outcome: verdict.value.outcome,
        score: verdict.value.score,
        reasons: verdict.value.reasons,
        flags: verdict.value.flags,
        modelVersion: deps.classifier.modelVersion,
        thresholdVersion: thresholds.version,
      });
      if (isErr(recorded)) return recorded;

      metrics.screenSeconds.observe(
        { outcome: verdict.value.outcome },
        (deps.now() - startedAt) / MS_PER_SECOND
      );
      metrics.screeningOutcomesTotal.inc({
        outcome: verdict.value.outcome,
        reason: verdict.value.reasons[0]?.reason ?? NO_REASON,
      });
      log.info(
        {
          outcome: verdict.value.outcome,
          score: verdict.value.score,
          reasons: verdict.value.reasons.map((r) => r.reason),
        },
        'screening finished'
      );
      return completeStep(toScreenResult(recorded.value));
    } finally {
      keepAlive.stop();
      await removeScratchDir(scratch);
    }
  };
}
