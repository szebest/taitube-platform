import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type {
  MediaTools,
  ProbeMetadata,
  TranscodeExecutionResult,
  TranscodeOptions,
} from '@vp/ffmpeg';
import { CANONICAL_LADDER, type LadderEntry } from '@vp/job-contracts';
import { type Logger, createLogger } from '@vp/logger';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';

export const OWNER_ID = SEEDED.userId;

export interface FlowWorld {
  repositories: InMemoryRepositories;
  storage: InMemoryStorageClient;
  queues: Map<string, InMemoryJobQueue>;
  getQueue: (name: string) => InMemoryJobQueue;
  flowProducer: InMemoryFlowProducer;
  logger: Logger;
}

export function flowWorld(): FlowWorld {
  const queues = new Map<string, InMemoryJobQueue>();
  const getQueue = (name: string): InMemoryJobQueue => {
    let queue = queues.get(name);
    if (!queue) {
      queue = new InMemoryJobQueue(name);
      queues.set(name, queue);
    }
    return queue;
  };
  return {
    repositories: new InMemoryRepositories(),
    storage: new InMemoryStorageClient(),
    queues,
    getQueue,
    flowProducer: new InMemoryFlowProducer(getQueue),
    logger: createLogger({ format: 'json', service: 'flow-spec', level: 'silent' }),
  };
}

export async function uploadedVideo(world: FlowWorld, sourceKey: string): Promise<string> {
  const videoId = uuidv7();
  expectOk(
    await world.repositories.videos.create({
      id: videoId,
      ownerId: OWNER_ID,
      title: sourceKey,
      status: 'UPLOADED',
      sourceKey,
      sourceSizeBytes: 10_000_000,
    })
  );
  expectOk(
    await world.storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: Buffer.from(sourceKey),
      contentType: 'video/mp4',
    })
  );
  return videoId;
}

export function rungs(...names: LadderEntry['name'][]): LadderEntry[] {
  return CANONICAL_LADDER.filter((rung) => names.includes(rung.name));
}

export function probed(
  source: { width: number; height: number; durationMs: number },
  ladder: LadderEntry[]
): ProbeMetadata {
  return {
    ...source,
    effectiveWidth: source.width,
    effectiveHeight: source.height,
    rotation: 0,
    fps: 24,
    videoCodec: 'h264',
    audioCodec: 'aac',
    bitrateKbps: ladder[0]?.videoKbps ?? 0,
    ladder,
  };
}

export async function encodeSegments(
  options: TranscodeOptions,
  count: number,
  segmentBytes = 100
): Promise<TranscodeExecutionResult> {
  for (let i = 1; i <= count; i++) {
    const segment = path.join(options.outputDir, `seg_${String(i).padStart(5, '0')}.ts`);
    // Renamed into place as FFmpeg's `temp_file` flag does: the uploader polls the directory and
    // would otherwise read a segment that is still being written.
    await fs.writeFile(`${segment}.tmp`, Buffer.alloc(segmentBytes));
    await fs.rename(`${segment}.tmp`, segment);
  }
  const playlistPath = path.join(options.outputDir, 'index.m3u8');
  await fs.writeFile(
    playlistPath,
    '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:6\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-ENDLIST\n'
  );
  return {
    outputDir: options.outputDir,
    playlistPath,
    segmentCount: count,
    durationMs: options.durationMs,
  };
}

export const writeThumbnails: MediaTools['thumbnail'] = async ({ outputDir }) => {
  const posterPath = path.join(outputDir, 'poster.jpg');
  const spritePath = path.join(outputDir, 'sprite.jpg');
  const vttPath = path.join(outputDir, 'sprite.vtt');
  await fs.writeFile(posterPath, Buffer.alloc(100));
  await fs.writeFile(spritePath, Buffer.alloc(100));
  await fs.writeFile(vttPath, 'WEBVTT\n');
  return { outputDir, posterPath, spritePath, vttPath, frameCount: 12, rows: 2, columns: 10 };
};

/** FFmpeg that probes as `metadata` and encodes every rendition as a single segment. */
export function fakeMedia(
  metadata: ProbeMetadata,
  transcode: MediaTools['transcode'] = (options) => encodeSegments(options, 1)
): MediaTools {
  return { probe: async () => metadata, transcode, thumbnail: writeThumbnails };
}

/** Settles when `jobId` completes on `queue`, and rejects with its error when it fails. */
export function completionOf(queue: InMemoryJobQueue, jobId: string): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  queue.onJobCompleted((job) => {
    if (job.id === jobId) resolve();
  });
  queue.onJobFailed((job, error) => {
    if (job.id === jobId) reject(error);
  });
  return promise;
}
