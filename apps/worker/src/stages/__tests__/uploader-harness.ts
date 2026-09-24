import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { MediaTools } from '@vp/ffmpeg';
import type { TranscodeJob } from '@vp/job-contracts';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';

export const RENDITION_720P = {
  name: '720p',
  width: 1280,
  height: 720,
  videoKbps: 2800,
  maxrateKbps: 2996,
  bufsizeKbps: 4200,
  audioKbps: 128,
  profile: 'high',
  level: '3.1',
} as const;

export interface SeededSource {
  sourceKey?: string;
  body?: Buffer;
}

/** A PROCESSING video with its source object uploaded and a pending 720p rendition. */
export async function seedTranscode(
  repositories: InMemoryRepositories,
  storage: InMemoryStorageClient,
  { sourceKey = 'raw/source.mp4', body = Buffer.from('mock-source') }: SeededSource = {}
): Promise<string> {
  const videoId = uuidv7();
  await repositories.videos.create({
    id: videoId,
    ownerId: uuidv7(),
    title: 'Test Video',
    status: 'PROCESSING',
    sourceKey,
    sourceSizeBytes: body.byteLength,
    durationMs: 60_000,
  });
  await storage.uploadObject({ bucket: 'raw', key: sourceKey, body, contentType: 'video/mp4' });
  await repositories.renditions.create({
    id: uuidv7(),
    videoId,
    name: RENDITION_720P.name,
    width: RENDITION_720P.width,
    height: RENDITION_720P.height,
    videoBitrateKbps: RENDITION_720P.videoKbps,
    audioBitrateKbps: RENDITION_720P.audioKbps,
  });
  return videoId;
}

export function transcodeJob(
  videoId: string,
  overrides: { attemptsMade?: number; streamingInput?: boolean; sourceKey?: string } = {}
): QueueJob<TranscodeJob> {
  const { attemptsMade = 0, streamingInput, sourceKey = 'raw/source.mp4' } = overrides;
  return {
    id: `${videoId}--transcode--720p--g1`,
    name: 'transcode',
    attemptsMade,
    data: {
      videoId,
      sourceKey,
      generation: 1,
      rendition: { ...RENDITION_720P },
      fps: 24,
      durationMs: 60_000,
      traceparent: '00-test-01-01',
      streamingInput,
    },
  };
}

export interface EncoderInput {
  sourcePath?: string;
  threads?: number;
}

/** An encoder that writes `segments` small segments and a playlist, and records its input. */
export function fakeEncoder(segments: number, seen: EncoderInput = {}): MediaTools {
  return {
    ...STAGE_SETTINGS.media,
    transcode: async (opts) => {
      seen.sourcePath = opts.sourcePath;
      seen.threads = opts.threads;
      for (let i = 0; i < segments; i++) {
        await fs.writeFile(
          path.join(opts.outputDir, `seg_${String(i).padStart(5, '0')}.ts`),
          Buffer.alloc(100)
        );
      }
      const playlistPath = path.join(opts.outputDir, 'index.m3u8');
      await fs.writeFile(playlistPath, '#EXTM3U\n');
      return {
        outputDir: opts.outputDir,
        playlistPath,
        segmentCount: segments,
        durationMs: 60_000,
      };
    },
  };
}

export async function exists(target: string): Promise<boolean> {
  return fs.access(target).then(
    () => true,
    () => false
  );
}
