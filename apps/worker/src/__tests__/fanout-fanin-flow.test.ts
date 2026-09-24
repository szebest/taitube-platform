import type { QueueJob } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { LadderEntry, type ProbeJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createFailureHandler } from '../failure-handler';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { createTranscodeProcessor } from '../stages/transcode';
import {
  type FlowWorld,
  encodeSegments,
  fakeMedia,
  flowWorld,
  probed,
  rungs,
  uploadedVideo,
} from './flow-harness';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, failingTranscodeOf, transcodeDeps } from './stage-settings';

const S60 = probed(
  { width: 1920, height: 1080, durationMs: 60_000 },
  rungs('1080p', '720p', '480p')
);

const probeJob = (videoId: string, sourceKey: string): QueueJob<ProbeJob> => ({
  id: `${videoId}--probe--g1`,
  name: 'probe',
  data: { videoId, sourceKey, generation: 1, traceparent: '00-01-01-01' },
  attemptsMade: 0,
});

describe('apps/worker: fan-out to renditions and fan-in to the package', () => {
  let world: FlowWorld;

  beforeEach(() => {
    world = flowWorld();
  });

  it('holds the package in waiting-children until the last child completes, then writes a master over every rendition', async () => {
    const videoId = await uploadedVideo(world, 'raw/s60.mp4');
    const media = fakeMedia(S60, (options) =>
      encodeSegments(options, 10, options.rendition.name === '1080p' ? 2000 : 1000)
    );
    const probe = createProbeProcessor({ ...STAGE_SETTINGS, ...world, media });
    expect(expectOk(await probe(probeJob(videoId, 'raw/s60.mp4'))).status).toBe('PROCESSING');

    const packageQueue = world.getQueue('package');
    const packageJobId = `${videoId}--package--g1`;
    const packageState = async () => expectOk(await packageQueue.getJobState(packageJobId));
    expect(await packageState()).toBe('waiting-children');

    await packageQueue.process(
      throughRunner(createPackageProcessor({ ...STAGE_SETTINGS, ...world }))
    );
    expect(await packageState()).toBe('waiting-children');
    expect(expectOk(await world.repositories.videos.findById(videoId))?.status).toBe('PROCESSING');

    const transcode = () =>
      throughRunner(createTranscodeProcessor(transcodeDeps({ ...world, media })));
    await world.getQueue('transcode-1080p').process(transcode());
    await world.getQueue('transcode-720p').process(transcode());
    expect(await packageState()).toBe('waiting-children');

    const thumbnail = createThumbnailProcessor({ ...STAGE_SETTINGS, ...world, media });
    await world.getQueue('thumbnail').process(throughRunner(thumbnail));
    expect(await packageState()).toBe('waiting-children');

    await world.getQueue('transcode-480p').process(transcode());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await packageState()).toBe('completed');

    const video = expectOk(await world.repositories.videos.findById(videoId));
    const masterKey = `videos/${videoId}/hls/master.m3u8`;
    expect(video?.status).toBe('READY');
    expect(video?.masterPlaylistKey).toBe(masterKey);
    expect(video?.readyAt).toBeDefined();

    for (const rendition of ['1080p', '720p', '480p']) {
      const playlist = `videos/${videoId}/hls/${rendition}/index.m3u8`;
      expect(await world.storage.headObject('public', playlist)).toBeTruthy();
    }
    expect(await world.storage.headObject('public', masterKey)).toBeTruthy();

    const master = expectOk(await world.storage.getObject('public', masterKey)).toString('utf-8');
    const lines = master.split('\n');
    expect(lines.filter((line) => line.startsWith('#EXT-X-STREAM-INF:'))).toHaveLength(3);
    expect(master).toContain('CODECS="avc1.640029,mp4a.40.2"');
    expect(master).toContain('CODECS="avc1.64001f,mp4a.40.2"');
    expect(master).toContain('CODECS="avc1.4d401f,mp4a.40.2"');
    expect(master).toMatch(/AVERAGE-BANDWIDTH=\d+/);
    const at = (rendition: string) =>
      lines.findIndex((line) => line.includes(`${rendition}/index.m3u8`));
    expect(at('1080p')).toBeLessThan(at('720p'));
    expect(at('720p')).toBeLessThan(at('480p'));
  });

  it('stores the probed ladder on each video and moves each rendition PENDING -> RUNNING -> DONE on its own', async () => {
    const p720Id = await uploadedVideo(world, 'raw/p720.mp4');
    const sd360Id = await uploadedVideo(world, 'raw/sd360.mp4');
    const p720 = probed({ width: 1280, height: 720, durationMs: 30_000 }, rungs('720p', '480p'));
    const sd360 = probed({ width: 640, height: 360, durationMs: 15_000 }, rungs('480p'));
    const renditionsOf = async (videoId: string) =>
      expectOk(await world.repositories.renditions.findByVideoId(videoId));
    const ladderOf = async (videoId: string) => {
      const video = expectOk(await world.repositories.videos.findById(videoId));
      return LadderEntry.array()
        .parse(video?.ladder)
        .map((rung) => rung.name);
    };
    const media = fakeMedia(p720, async (options) => {
      const inFlight = (await renditionsOf(p720Id)).find((r) => r.name === options.rendition.name);
      expect(inFlight?.status).toBe('RUNNING');
      return encodeSegments(options, 1);
    });

    await createProbeProcessor({ ...STAGE_SETTINGS, ...world, media })(
      probeJob(p720Id, 'raw/p720.mp4')
    );
    expect(await ladderOf(p720Id)).toEqual(['720p', '480p']);
    expect((await renditionsOf(p720Id)).map((r) => r.status)).toEqual(['PENDING', 'PENDING']);

    await createProbeProcessor({ ...STAGE_SETTINGS, ...world, media: fakeMedia(sd360) })(
      probeJob(sd360Id, 'raw/sd360.mp4')
    );
    expect(await ladderOf(sd360Id)).toEqual(['480p']);

    const transcode720 = createTranscodeProcessor(transcodeDeps({ ...world, media }));
    await world.getQueue('transcode-720p').process(throughRunner(transcode720));

    const renditions = await renditionsOf(p720Id);
    expect(renditions.find((r) => r.name === '720p')?.status).toBe('DONE');
    expect(renditions.find((r) => r.name === '480p')?.status).toBe('PENDING');
  });

  it("fails the parent and the video with the child's code on a permanent FFmpeg failure, leaving sibling outputs in place", async () => {
    const videoId = await uploadedVideo(world, 'raw/s60.mp4');
    const media = fakeMedia(
      probed({ width: 1920, height: 1080, durationMs: 60_000 }, rungs('720p', '480p'))
    );
    await createProbeProcessor({ ...STAGE_SETTINGS, ...world, media })(
      probeJob(videoId, 'raw/s60.mp4')
    );

    world.getQueue('package').onFailed(
      createFailureHandler({
        ...STAGE_SETTINGS,
        ...world,
        stage: 'package',
        queueName: 'package',
      })
    );

    const playlist720 = `videos/${videoId}/hls/720p/index.m3u8`;
    const renditionStatus = async (name: string) =>
      expectOk(await world.repositories.renditions.findByVideoId(videoId)).find(
        (r) => r.name === name
      )?.status;

    const transcode720 = createTranscodeProcessor(transcodeDeps({ ...world, media }));
    await world.getQueue('transcode-720p').process(throughRunner(transcode720));
    expect(await world.storage.headObject('public', playlist720)).toBeTruthy();
    expect(await renditionStatus('720p')).toBe('DONE');

    const transcode480 = createTranscodeProcessor(
      transcodeDeps({ ...world, media: failingTranscodeOf('480p') })
    );
    await expect(
      world.getQueue('transcode-480p').process(throughRunner(transcode480))
    ).rejects.toThrow('FFmpeg failed for transcode-480p');

    const failed = expectOk(await world.repositories.videos.findById(videoId));
    expect(failed?.status).toBe('FAILED');
    expect(failed?.errorCode).toBe(ErrorCodes.FFMPEG_FAILED);
    expect(await world.storage.headObject('public', playlist720)).toBeTruthy();
    expect(await renditionStatus('720p')).toBe('DONE');
    expect(await renditionStatus('480p')).toBe('FAILED');
  });
});
