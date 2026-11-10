import {
  InMemoryFrameClassifier,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { FingerprintTools } from '@vp/fingerprint';
import type { ScreenJob } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { SEEDED, createMockJob } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import { createScreenProcessor } from '../screen-stage';

const HASH_BITS = 64n;
const LCG_MUL = 6364136223846793005n;
const LCG_ADD = 1442695040888963407n;

/** Frames of a pretend video: the same seed gives the same frames, another seed shares none. */
type FrameSample = Awaited<ReturnType<FingerprintTools['sampleFrames']>>[number];

export function framesOf(seed: number, count: number, from = 0): FrameSample[] {
  return Array.from({ length: count }, (_, index) => {
    const state = BigInt.asUintN(
      Number(HASH_BITS),
      (BigInt(seed) * 1_000_003n + BigInt(from + index) + 1n) * LCG_MUL + LCG_ADD
    );
    const hash = BigInt.asUintN(Number(HASH_BITS), state * LCG_MUL + LCG_ADD);
    return {
      hash,
      mirroredHash: BigInt.asUintN(Number(HASH_BITS), ~hash),
      luma: 40 + ((from + index) % 90) * 2,
    };
  });
}

export const BLANK_FRAMES: FrameSample[] = Array.from({ length: 30 }, () => ({
  hash: 0x0123_4567_89ab_cdefn,
  mirroredHash: 0xfedc_ba98_7654_3210n,
  luma: 16,
}));

export interface Footage {
  frames: FrameSample[];
  /** Brightness of every classified frame, 0 to 255; the in-memory classifier scores by it. */
  brightness?: number;
  terms?: number[];
}

export type RecordedTools = FingerprintTools & { calls: string[] };

/** The real processes replaced by what the footage says they would have found. */
export function toolsFor(footage: Footage): RecordedTools {
  const calls: string[] = [];
  return {
    calls,
    sampleFrames: async () => {
      calls.push('sampleFrames');
      return footage.frames;
    },
    runFpcalc: async () => {
      calls.push('runFpcalc');
      return { durationSeconds: 30, terms: footage.terms ?? [] };
    },
    sampleClassifierFrames: async (options) => {
      calls.push('sampleClassifierFrames');
      return options.timestampsSeconds.map((timestampSeconds) => ({
        timestampSeconds,
        frame: {
          width: options.size,
          height: options.size,
          data: new Uint8Array(options.size * options.size * 3).fill(footage.brightness ?? 0),
        },
      }));
    },
    extractEvidenceFrame: async () => {
      calls.push('extractEvidenceFrame');
      return Uint8Array.of(0xff, 0xd8, 0xff, 0xd9);
    },
  };
}

export const CLASSIFIER_SIZE = 4;
const brightnessClassifier = () => new InMemoryFrameClassifier({ inputSize: CLASSIFIER_SIZE });

export const OTHER_OWNER = '00000000-0000-7000-8000-0000000000aa';

interface VideoOverrides {
  ownerId?: string;
  status?: 'PROCESSING' | 'REJECTED';
  title?: string;
}

/** A catalogue and a raw bucket of doubles, and the stage over them with the footage a spec hands it. */
export function screenWorld() {
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const logger = createLogger({ format: 'json', service: 'screen-test', level: 'silent' });

  async function video(
    overrides: VideoOverrides = {}
  ): Promise<{ videoId: string; sourceKey: string }> {
    const videoId = uuidv7();
    const sourceKey = `raw/${videoId}/source.mp4`;
    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId: overrides.ownerId ?? SEEDED.userId,
        title: overrides.title ?? 'A calm walk',
        status: overrides.status ?? 'PROCESSING',
        sourceKey,
        durationMs: 30_000,
      })
    );
    expectOk(
      await storage.uploadObject({
        bucket: 'raw',
        key: sourceKey,
        body: videoId,
        contentType: 'video/mp4',
      })
    );
    return { videoId, sourceKey };
  }

  const job = (
    videoId: string,
    sourceKey: string,
    hasAudio = false,
    durationMs = 30_000
  ): QueueJob<ScreenJob> =>
    createMockJob(
      'screen',
      { videoId, sourceKey, generation: 1, durationMs, hasAudio, traceparent: '00-01-01-01' },
      { id: `${videoId}--screen--g1` }
    );

  const processor = (
    tools: RecordedTools,
    classifier: InMemoryFrameClassifier = brightnessClassifier()
  ) =>
    createScreenProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      fingerprint: tools,
      classifier,
    });

  async function screen(footage: Footage, overrides: VideoOverrides = {}, hasAudio = false) {
    const { videoId, sourceKey } = await video(overrides);
    const tools = toolsFor(footage);
    const result = await processor(tools)(job(videoId, sourceKey, hasAudio));
    return { videoId, sourceKey, tools, result };
  }

  const stored = async (videoId: string) =>
    expectOk(await repositories.screenings.latestForVideo(videoId));

  return { repositories, storage, video, job, processor, screen, stored };
}

export type ScreenWorld = ReturnType<typeof screenWorld>;
