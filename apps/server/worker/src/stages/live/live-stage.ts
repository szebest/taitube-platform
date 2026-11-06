import type { CacheClient, LiveGatewayPort, QueueJob, StorageClient } from '@vp/core/ports';
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
import { publishVideoEvent } from '@vp/events';
import type { MediaTools } from '@vp/ffmpeg';
import type { LiveJob } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { andThenAsync, err, fromPromise, ignore, isErr, isOk, ok, type Result } from '@vp/result';
import { finalizeBroadcast, LIVE_RUNG, writeLiveMaster } from './live-finalize';
import { LiveSession, loadLiveArchive } from './live-session';
import type { LiveUploader } from './live-uploader';

export interface LiveStageDeps {
  config: AppConfig;
  repositories: Repositories;
  storage: StorageClient;
  liveGateway: LiveGatewayPort;
  cache: Pick<CacheClient, 'publish'>;
  media: MediaTools;
  logger: Logger;
  now: () => number;
  newUploader: () => LiveUploader;
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

function noPublisher(message: string): MediaFailure {
  return mediaFailure(STAGE, ErrorCodes.LIVE_INGEST_UNAVAILABLE, message);
}

/** The worker reads a publisher back over RTSP as the one reader the auth hook admits. */
function ingestUrl(base: string, streamKey: string, secret: string | undefined): string {
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
  const { config, repositories, storage, logger, newUploader } = deps;
  const { live, worker } = config;
  const gateway = deps.liveGateway;
  const publicBucket = config.buckets.public;

  async function waitForPublisher(path: string): Promise<Result<boolean, LiveGatewayUnavailable>> {
    const deadline = deps.now() + live.packaging.publishWaitMs;
    for (;;) {
      const publishing = await gateway.isPublishing(path);
      if (!isOk(publishing) || publishing.value || deps.now() >= deadline) return publishing;
      await deps.wait(live.packaging.publishPollMs);
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
    if (!waited.value) return err(noPublisher('nobody is publishing on the stream key'));

    const loaded = await loadLiveArchive(storage, publicBucket, stream.id);
    if (isErr(loaded)) return loaded;
    const session = new LiveSession(stream.id, live.packaging, uploader, loaded.value);
    writeLiveMaster(uploader, stream.id, live.packaging, 'index.m3u8');

    const ran = await fromPromise(
      () =>
        deps.media.live({
          ffmpegPath: worker.ffmpegPath,
          limits: worker.ffmpegProcess,
          preset: worker.x264Preset,
          threads: worker.ffmpegThreads,
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
      const kick = async (streamKey: string) => {
        const kicked = await gateway.kick(liveStreamPath(streamKey));
        if (isErr(kicked)) logger.warn({ err: kicked.error, liveStreamId }, 'publisher not kicked');
      };
      const finalize = async () => {
        const finalized = await andThenAsync(
          await loadLiveArchive(storage, publicBucket, stream.id),
          (archive) =>
            finalizeBroadcast(
              {
                repositories,
                uploader: newUploader(),
                packaging: live.packaging,
                now: deps.now,
              },
              stream,
              archive
            )
        );
        if (isErr(finalized)) return finalized;
        if (stream.videoId !== null) {
          ignore(
            await publishVideoEvent({
              cache: deps.cache,
              videoId: stream.videoId,
              event: 'live.status',
              data: { liveStreamId, status: 'ENDED' },
              ts: deps.now(),
            }),
            'a viewer who misses the end still gets the status event the archive brings'
          );
        }
        if (stream.streamKey === null) return finalized;
        // A publisher admitted after the last check is orphaned; dropped, it re-auths as the next
        // stream. One that already went live on the next stream, which holds the same key, stays.
        const next = await repositories.liveStreams.findByKey(stream.streamKey);
        if (!(isOk(next) && next.value?.status === 'LIVE')) await kick(stream.streamKey);
        return finalized;
      };

      if (stream.status === 'ENDED') return finalize();
      if (stream.status !== 'LIVE' || stream.streamKey === null) {
        return err(liveStreamNotLive(liveStreamId));
      }

      const outcome = await broadcast(stream, stream.streamKey, newUploader());
      if (isOk(outcome)) return finalize();
      if (!lastAttempt) return outcome;

      await kick(stream.streamKey);
      const finalized = await finalize();
      return isErr(finalized) ? finalized : outcome;
    });
  };
}
