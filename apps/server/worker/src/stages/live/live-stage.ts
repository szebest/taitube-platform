import type { LiveGatewayPort, QueueJob, StorageClient } from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import { type LiveStream, liveStreamPath } from '@vp/domain';
import {
  LIVE_READER_USER,
  type LiveStreamNotFound,
  type LiveStreamNotLive,
  liveStreamNotFound,
  liveStreamNotLive,
} from '@vp/domain-rules';
import type { AppConfig } from '@vp/env-schema';
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type LiveGatewayUnavailable,
  type MediaFailure,
  mediaFailure,
  mediaFailureFrom,
  type StorageUnavailable,
} from '@vp/errors';
import type { FfmpegProcessLimits, MediaTools } from '@vp/ffmpeg';
import type { LiveJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { andThenAsync, err, fromPromise, isErr, isOk, ok, type Result } from '@vp/result';
import { finalizeBroadcast, LIVE_RUNG, writeLiveMaster } from './live-finalize';
import { LiveSession, loadLiveArchive } from './live-session';
import { LiveUploader } from './live-uploader';

export interface LiveStageDeps {
  repositories: Repositories;
  storage: StorageClient;
  gateway: LiveGatewayPort;
  media: MediaTools;
  publicBucket: string;
  live: AppConfig['live'];
  ffmpeg: { path: string; limits: FfmpegProcessLimits; preset: string; threads: number };
  logger: Logger;
  now: () => number;
  wait: (ms: number) => Promise<void>;
}

type LiveStageFailure =
  | LiveStreamNotFound
  | LiveStreamNotLive
  | DatabaseUnavailable
  | StorageUnavailable
  | LiveGatewayUnavailable
  | MediaFailure;

const STAGE = 'live';
const PUBLISHER_POLL_MS = 500;

function noPublisher(message: string): MediaFailure {
  return mediaFailure(STAGE, ErrorCodes.LIVE_INGEST_UNAVAILABLE, message);
}

/** The worker reads a publisher back over RTSP as the one reader the auth hook admits. */
export function ingestUrl(base: string, streamKey: string, secret: string | undefined): string {
  const url = new URL(liveStreamPath(streamKey), `${base.replace(/\/$/, '')}/`);
  url.username = LIVE_READER_USER;
  url.password = secret ?? '';
  return url.toString();
}

/**
 * Packages one broadcast for as long as its publisher sends, then archives it. A run that stops while
 * the publisher is still sending fails, and the retry carries the broadcast on in a new epoch; the
 * last attempt ends the broadcast with whatever it recorded rather than leave it live forever.
 */
export function createLiveStage(deps: LiveStageDeps) {
  const { repositories, storage, gateway, live, logger } = deps;

  async function waitForPublisher(path: string): Promise<Result<boolean, LiveGatewayUnavailable>> {
    const deadline = deps.now() + live.packaging.publishWaitMs;
    for (;;) {
      const publishing = await gateway.isPublishing(path);
      if (!isOk(publishing) || publishing.value || deps.now() >= deadline) return publishing;
      await deps.wait(PUBLISHER_POLL_MS);
    }
  }

  async function broadcast(
    stream: LiveStream,
    streamKey: string,
    uploader: LiveUploader
  ): Promise<Result<void, LiveStageFailure>> {
    const path = liveStreamPath(streamKey);
    const waited = await waitForPublisher(path);
    if (isErr(waited)) return waited;
    if (!waited.value) return err(noPublisher(`nobody is publishing on ${path}`));

    const loaded = await loadLiveArchive(storage, deps.publicBucket, stream.id);
    if (isErr(loaded)) return loaded;
    const session = new LiveSession(stream.id, live.packaging, uploader, loaded.value);
    writeLiveMaster(uploader, stream.id, live.packaging, 'index.m3u8');

    const ran = await fromPromise(
      () =>
        deps.media.live({
          ffmpegPath: deps.ffmpeg.path,
          limits: deps.ffmpeg.limits,
          preset: deps.ffmpeg.preset,
          threads: deps.ffmpeg.threads,
          inputUrl: ingestUrl(live.ingestUrl, streamKey, live.hookSecret),
          rendition: LIVE_RUNG,
          fps: live.packaging.fps,
          segmentMs: live.packaging.segmentMs,
          partMs: live.packaging.partMs,
          readTimeoutMs: live.packaging.readTimeoutMs,
          timeoutMs: live.packaging.maxBroadcastMs,
          signal: uploader.signal,
          onFragment: (fragment) => session.accept(fragment),
        }),
      (cause) => mediaFailureFrom(STAGE, cause)
    );
    const finished = await session.finish();
    if (isErr(finished)) return finished;

    const still = await gateway.isPublishing(path);
    if (isOk(still) && still.value) {
      return err(isErr(ran) ? ran.error : noPublisher('the ingest stopped mid-broadcast'));
    }
    if (isErr(ran)) logger.warn({ err: ran.error, liveStreamId: stream.id }, 'live ingest ended');
    return ok();
  }

  return async (job: QueueJob<LiveJob>): Promise<Result<void, LiveStageFailure>> => {
    const { liveStreamId } = job.data;
    const lastAttempt = (job.attemptsMade ?? 0) + 1 >= (job.opts?.attempts ?? 1);

    return andThenAsync(await repositories.liveStreams.findById(liveStreamId), async (stream) => {
      if (stream === null) return err(liveStreamNotFound(liveStreamId));
      const finalize = async () =>
        andThenAsync(await loadLiveArchive(storage, deps.publicBucket, stream.id), (archive) =>
          finalizeBroadcast(
            {
              repositories,
              uploader: new LiveUploader(storage, deps.publicBucket),
              packaging: live.packaging,
              now: deps.now,
            },
            stream,
            archive
          )
        );

      if (stream.status === 'ENDED') return finalize();
      if (stream.status !== 'LIVE' || stream.streamKey === null) {
        return err(liveStreamNotLive(liveStreamId));
      }

      const outcome = await broadcast(
        stream,
        stream.streamKey,
        new LiveUploader(storage, deps.publicBucket)
      );
      if (isOk(outcome)) return finalize();
      if (!lastAttempt) return outcome;

      const kicked = await gateway.kick(liveStreamPath(stream.streamKey));
      if (isErr(kicked)) logger.warn({ err: kicked.error, liveStreamId }, 'publisher not kicked');
      const finalized = await finalize();
      return isErr(finalized) ? finalized : outcome;
    });
  };
}
