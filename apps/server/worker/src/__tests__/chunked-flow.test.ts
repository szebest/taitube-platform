import type { QueueJob } from '@vp/core/ports';
import type { MediaTools } from '@vp/ffmpeg';
import type { ProbeJob } from '@vp/job-contracts';
import { chunkPrefix } from '@vp/storage';
import { createMockJob } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { STAGE_REGISTRY } from '../registry';
import {
  type FlowWorld,
  chunkTools,
  completionOf,
  fakeMedia,
  flowWorld,
  probed,
  rungs,
  uploadedVideo,
} from './flow-harness';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, registryDeps } from './stage-settings';

describe('apps/server/worker: chunked transcode flow', () => {
  let world: FlowWorld;

  beforeEach(() => {
    world = flowWorld();
  });

  it('encodes a six minute source in twelve chunks, concatenates them and leaves no chunk behind', async () => {
    const videoId = await uploadedVideo(world, 'raw/s360.mp4');
    const slices: number[] = [];
    const concats: number[] = [];
    const media: MediaTools = {
      ...fakeMedia(probed({ width: 1280, height: 720, durationMs: 360_000 }, rungs('720p'))),
      transcodeChunk: async (options) => {
        slices.push(options.startSeconds);
        await chunkTools.transcodeChunk(options);
      },
      concat: async (options) => {
        concats.push(options.durationMs);
        await chunkTools.concat(options);
      },
    };
    const probe = createProbeProcessor({ ...STAGE_SETTINGS, ...world, media });
    const probeJob: QueueJob<ProbeJob> = createMockJob(
      'probe',
      { videoId, sourceKey: 'raw/s360.mp4', generation: 1, traceparent: '00-01-01-01' },
      { id: `${videoId}--probe--g1` }
    );
    expectOk(await probe(probeJob));

    const packageQueue = world.getQueue('package');
    const packageJobId = `${videoId}--package--g1`;
    await packageQueue.process(
      throughRunner(createPackageProcessor({ ...STAGE_SETTINGS, ...world }))
    );
    const thumbnail = createThumbnailProcessor({ ...STAGE_SETTINGS, ...world, media });
    await world.getQueue('thumbnail').process(throughRunner(thumbnail));

    const packaged = completionOf(packageQueue, packageJobId);
    const transcode = STAGE_REGISTRY['transcode-720p'].createProcessor(registryDeps(world, media));
    await world.getQueue('transcode-720p').process(throughRunner(transcode));
    await packaged;

    expect(slices.sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i * 30));
    expect(concats).toEqual([360_000]);
    expect(expectOk(await world.repositories.videos.findById(videoId))?.status).toBe('READY');
    const [rendition] = expectOk(await world.repositories.renditions.findByVideoId(videoId));
    expect(rendition?.status).toBe('DONE');
    const left = expectOk(
      await world.storage.listObjects({ bucket: 'raw', prefix: chunkPrefix(videoId, 1, '720p') })
    );
    expect(left.keys).toEqual([]);
  });
});
