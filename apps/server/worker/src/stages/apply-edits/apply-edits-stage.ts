import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Logger } from '@kit/logger';
import { getHeaderMapping } from '@kit/object-storage';
import { type Result, fromPromise, isErr, ok } from '@kit/result';
import type { QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories, SwapOutcome } from '@vp/core/repositories';
import type { GenerationPlayback } from '@vp/domain';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type MediaFailure,
  type StorageUnavailable,
  mediaFailureFrom,
} from '@vp/errors';
import {
  type FfmpegProcessLimits,
  type MediaTools,
  type ProbeMetadata,
  computeFfmpegThreads,
  generateMasterPlaylist,
} from '@vp/ffmpeg';
import type { ApplyEditsJob, LadderEntry } from '@vp/job-contracts';
import { masterPlaylistKey, renditionPrefix } from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import { createScratchDir, removeScratchDir } from '../scratch-dir';
import { type GenerationSource, fetchGenerationSource } from './generation-source';
import { uploadRendition } from './upload-rendition';

export interface ApplyEditsDeps {
  repositories: Repositories;
  storage: StorageClient;
  media: MediaTools;
  rawBucket: string;
  publicBucket: string;
  logger: Logger;
  tmpDir: string;
  ffprobePath: string;
  maxDurationSeconds: number;
  ffmpeg: {
    path: string;
    threads: number;
    preset: string;
    gopSeconds: number;
    hlsSegmentSeconds: number;
    timeoutFactor: number;
    minTimeoutMs: number;
    limits: FfmpegProcessLimits;
  };
  now: () => number;
}

export type ApplyEditsOutcome = SwapOutcome['type'] | 'not-rendering';

export type ApplyEditsFailure = MediaFailure | StorageUnavailable | DatabaseUnavailable;

const NO_EDITS = { trim: null, blurs: [] };

/**
 * Renders a replacement's upload, or an edit of its base generation, into a new generation and swaps
 * it in. Every rendition is one encode through the edit list's filter graph, written under the new
 * generation's prefix while the video keeps playing the old one; the master goes last, then the swap,
 * which lands once whatever retries: a retry finds the generation swapped and is fenced out.
 */
export function createApplyEditsProcessor(deps: ApplyEditsDeps) {
  const { repositories, storage, media, publicBucket, ffmpeg } = deps;

  return async function processApplyEdits(
    job: QueueJob<ApplyEditsJob>
  ): Promise<Result<{ outcome: ApplyEditsOutcome }, ApplyEditsFailure>> {
    const { videoId, generation } = job.data;
    const attempt = (job.attemptsMade ?? 0) + 1;
    const log = deps.logger.child({
      videoId,
      generation,
      jobId: job.id,
      stage: 'apply-edits',
      attempt,
    });
    const lockToken = uuidv7();

    const claimed = await repositories.videoGenerations.claim(videoId, generation, lockToken);
    if (isErr(claimed)) return claimed;
    if (!claimed.value) {
      log.warn('generation is rendering no more; fenced out');
      return ok({ outcome: 'not-rendering' });
    }

    const dir = await createScratchDir(deps.tmpDir, `vp-apply-edits-${videoId}-`);
    try {
      const source = await fetchGenerationSource(deps, claimed.value, dir);
      if (isErr(source)) return source;
      const probed = await fromPromise(
        () =>
          media.probe(source.value.path, {
            ffprobePath: deps.ffprobePath,
            maxDurationSec: deps.maxDurationSeconds,
          }),
        (cause) => mediaFailureFrom('apply-edits', cause, ErrorCodes.CORRUPT_CONTAINER)
      );
      if (isErr(probed)) return probed;

      const rendered = await renderLadder(source.value, probed.value, dir, attempt);
      if (isErr(rendered)) return rendered;

      const swapped = await repositories.videoGenerations.swap({
        videoId,
        generation,
        claim: { type: 'render', lockToken, playback: rendered.value },
        now: new Date(deps.now()),
      });
      if (isErr(swapped)) return swapped;
      if (swapped.value.type === 'superseded') {
        const failed = await repositories.videoGenerations.fail(
          videoId,
          generation,
          ErrorCodes.VERSION_CONFLICT
        );
        if (isErr(failed)) return failed;
      }
      log.info({ outcome: swapped.value.type }, 'generation rendered');
      return ok({ outcome: swapped.value.type });
    } finally {
      await removeScratchDir(dir);
    }

    async function renderLadder(
      source: GenerationSource,
      metadata: ProbeMetadata,
      root: string,
      tries: number
    ): Promise<Result<GenerationPlayback, ApplyEditsFailure>> {
      const ladder: LadderEntry[] = source.type === 'edit' ? source.ladder : metadata.ladder;
      const edits = source.type === 'edit' ? source.edits : NO_EDITS;
      for (const rendition of ladder) {
        const outputDir = path.join(root, 'out', rendition.name);
        await fs.mkdir(outputDir, { recursive: true });
        const encoded = await fromPromise(
          () =>
            media.applyEdits({
              ffmpegPath: ffmpeg.path,
              sourcePath: source.path,
              outputDir,
              rendition,
              fps: metadata.fps,
              durationMs: metadata.durationMs,
              gopSeconds: ffmpeg.gopSeconds,
              hlsSegmentSeconds: ffmpeg.hlsSegmentSeconds,
              threads: computeFfmpegThreads(ffmpeg.threads, tries),
              preset: ffmpeg.preset,
              timeoutFactor: ffmpeg.timeoutFactor,
              minTimeoutMs: ffmpeg.minTimeoutMs,
              limits: ffmpeg.limits,
              edits,
              hasAudio: metadata.audioCodec !== undefined,
            }),
          (cause) => mediaFailureFrom('apply-edits', cause)
        );
        if (isErr(encoded)) return encoded;
        const uploaded = await uploadRendition(
          storage,
          publicBucket,
          outputDir,
          renditionPrefix(videoId, rendition.name, generation)
        );
        if (isErr(uploaded)) return uploaded;
      }

      const masterKey = masterPlaylistKey(videoId, generation);
      const headers = getHeaderMapping('master.m3u8');
      const master = await storage.uploadObject({
        bucket: publicBucket,
        key: masterKey,
        body: generateMasterPlaylist({ ladder, fps: metadata.fps }),
        contentType: headers.contentType,
        cacheControl: headers.cacheControl,
      });
      if (isErr(master)) return master;

      const trim = edits.trim;
      return ok({
        masterPlaylistKey: masterKey,
        durationMs: trim ? trim.endMs - trim.startMs : metadata.durationMs,
        width: metadata.effectiveWidth,
        height: metadata.effectiveHeight,
        fps: metadata.fps,
        ladder,
      });
    }
  };
}
