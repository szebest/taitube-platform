import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { MediaTools } from '@vp/ffmpeg';
import { createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { createTranscodeProcessor } from '../stages/transcode';
import { encodeSegments } from './flow-harness';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, failingThumbnails, transcodeDeps } from './stage-settings';

const logger = createLogger({ format: 'json', service: 'thumbnail-test', level: 'silent' });

function fakeTranscode(delayMs: number): MediaTools {
  return {
    ...STAGE_SETTINGS.media,
    transcode: async (options) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return encodeSegments(options, 5);
    },
  };
}

describe('thumbnail stage as a non-blocking flow child', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let queues: Map<string, InMemoryJobQueue>;
  let flowProducer: InMemoryFlowProducer;

  function getQueue(name: string): InMemoryJobQueue {
    let q = queues.get(name);
    if (!q) {
      q = new InMemoryJobQueue(name);
      queues.set(name, q);
    }
    return q;
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    queues = new Map();
    flowProducer = new InMemoryFlowProducer(getQueue);
  });

  async function runFlow(transcode: MediaTools, thumbnails?: MediaTools): Promise<string> {
    const sourceKey = 'raw/s15.mp4';
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: '00000000-0000-7000-8000-000000000001',
      title: 'Flow Video',
      status: 'UPLOADED',
      sourceKey,
    });
    await storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: await fs.readFile(path.resolve(__dirname, '../../../../tests/fixtures/s15.mp4')),
      contentType: 'video/mp4',
    });

    const deps = { ...STAGE_SETTINGS, repositories, storage, logger, getQueue };
    await createProbeProcessor({ ...deps, flowProducer })({
      id: `${videoId}--probe--g1`,
      name: 'probe',
      data: { videoId, sourceKey, generation: 1, traceparent: '00-01' },
      attemptsMade: 0,
    });
    await getQueue('package').process(throughRunner(createPackageProcessor(deps)));

    const thumbnail = createThumbnailProcessor({
      ...deps,
      media: thumbnails ?? STAGE_SETTINGS.media,
    });
    await Promise.all([
      ...['1080p', '720p', '480p'].map((rung) =>
        getQueue(`transcode-${rung}`).process(
          throughRunner(
            createTranscodeProcessor(
              transcodeDeps({ repositories, storage, logger, media: transcode })
            )
          )
        )
      ),
      getQueue('thumbnail')
        .process(thumbnail)
        .catch(() => {}),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return videoId;
  }

  it('runs the thumbnail child concurrently with the transcodes and reaches READY', async () => {
    const videoId = await runFlow(fakeTranscode(30));

    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      status: 'READY',
      posterKey: `videos/${videoId}/thumbs/poster.jpg`,
      spriteKey: `videos/${videoId}/thumbs/sprite.jpg`,
    });
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    expect(thumbStep).toBeDefined();
    const thumbStart = thumbStep?.startedAt?.getTime() ?? 0;
    const thumbEnd = thumbStep?.finishedAt?.getTime() ?? 0;
    const overlapsATranscode = steps
      .filter((s) => s.step.startsWith('transcode'))
      .some((s) => {
        const start = s.startedAt?.getTime() ?? 0;
        const end = s.finishedAt?.getTime() ?? 0;
        return thumbStart <= end && start <= thumbEnd;
      });
    expect(overlapsATranscode).toBe(true);
  });

  it('still packages the video when the thumbnail encode fails, leaving it without a poster', async () => {
    const videoId = await runFlow(fakeTranscode(0), failingThumbnails);

    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      status: 'READY',
      posterKey: null,
      spriteKey: null,
    });
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    expect(steps.find((s) => s.step === 'thumbnail')).toMatchObject({
      status: 'FAILED',
      errorCode: 'FFMPEG_FAILED',
    });
    const renditions = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(renditions).toHaveLength(3);
    expect(renditions.every((r) => r.status === 'DONE')).toBe(true);
  });
});
