import type { Repositories } from '@vp/core/repositories';
import type { LiveStream } from '@vp/domain';
import type { LivePackaging } from '@vp/env-schema';
import { type DatabaseUnavailable, ErrorCodes, type StorageUnavailable } from '@vp/errors';
import { generateMasterPlaylist } from '@vp/ffmpeg';
import { CANONICAL_LADDER } from '@vp/job-contracts';
import { andThenAsync, map, ok, type Result } from '@vp/result';
import { LIVE_PLAYLIST_HEADERS, liveMasterKey } from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import { type LiveArchive, writeLiveArchive } from './live-session';
import type { LiveUploader } from './live-uploader';

/** Every broadcast is packaged as this one rung: what the encoder is told and the master advertises. */
export const [, LIVE_RUNG] = CANONICAL_LADDER;

export interface LiveFinalizeDeps {
  repositories: Repositories;
  uploader: LiveUploader;
  packaging: LivePackaging;
  now: () => number;
}

/** The master playlist a broadcast's video plays from: the live playlist while it runs, the archive after. */
export function writeLiveMaster(
  uploader: LiveUploader,
  streamId: string,
  packaging: LivePackaging,
  playlist: 'index.m3u8' | 'archive.m3u8'
): void {
  const master = generateMasterPlaylist({
    ladder: [LIVE_RUNG],
    fps: packaging.fps,
    uriOf: () => playlist,
  });
  uploader.enqueue(() => uploader.put(liveMasterKey(streamId), master, LIVE_PLAYLIST_HEADERS));
}

/**
 * Ends a broadcast: closes its archive with `#EXT-X-ENDLIST`, ends the stream, and turns its video
 * into the archive with nothing re-encoded. A broadcast that never got a whole segment out fails
 * its video instead. Each step is idempotent, so a retried job finishes what a crashed one began.
 */
export async function finalizeBroadcast(
  deps: LiveFinalizeDeps,
  stream: LiveStream,
  archive: LiveArchive
): Promise<Result<void, DatabaseUnavailable | StorageUnavailable>> {
  const { repositories, uploader, packaging, now } = deps;
  const recorded = archive.segments.length > 0;

  if (recorded) {
    writeLiveArchive(uploader, stream.id, archive, { segmentMs: packaging.segmentMs, ended: true });
    writeLiveMaster(uploader, stream.id, packaging, 'archive.m3u8');
  }

  return andThenAsync(await uploader.drained(), async () =>
    andThenAsync(
      await repositories.liveStreams.end({
        streamId: stream.id,
        endedAt: new Date(now()),
        nextId: uuidv7(),
      }),
      async (ended) => {
        const { videoId, archiveVisibility } = ended ?? stream;
        if (videoId === null) return ok();

        const transitioned = recorded
          ? await repositories.videos.transition({
              videoId,
              from: 'LIVE',
              to: 'READY',
              eventType: 'video.ready',
              eventPayload: { liveStreamId: stream.id },
              patch: {
                masterPlaylistKey: liveMasterKey(stream.id),
                durationMs: archive.segments.reduce((total, s) => total + s.durationMs, 0),
                width: LIVE_RUNG.width,
                height: LIVE_RUNG.height,
                fps: packaging.fps,
                visibility: archiveVisibility,
              },
            })
          : await repositories.videos.transition({
              videoId,
              from: 'LIVE',
              to: 'FAILED',
              eventType: 'video.failed',
              eventPayload: { liveStreamId: stream.id },
              patch: {
                errorCode: ErrorCodes.LIVE_INGEST_UNAVAILABLE,
                errorMessage: 'The broadcast ended before any media arrived',
              },
            });
        return map(transitioned, () => undefined);
      }
    )
  );
}
