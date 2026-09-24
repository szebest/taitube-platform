import type { QueueJob } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import type { PackageJob } from '@vp/job-contracts';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { type FlowWorld, OWNER_ID, flowWorld, rungs } from '../../__tests__/flow-harness';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createPackageProcessor } from '../package';

describe('apps/worker/stages: package', () => {
  let world: FlowWorld;
  let videoId: string;

  const job = (): QueueJob<PackageJob> => ({
    id: `${videoId}--package--g1`,
    name: 'package',
    data: { videoId, generation: 1, ladder: rungs('720p'), traceparent: '00-01-01-01' },
    attemptsMade: 0,
  });

  beforeEach(async () => {
    world = flowWorld();
    videoId = uuidv7();
    expectOk(
      await world.repositories.videos.create({
        id: videoId,
        ownerId: OWNER_ID,
        title: 'Package Video',
        status: 'PROCESSING',
        sourceKey: 'raw/s60.mp4',
        sourceSizeBytes: 5_000_000,
        durationMs: 60_000,
      })
    );
  });

  it('writes the master once the rendition playlist is there, flips the video READY once and enqueues notify', async () => {
    expectOk(
      await world.storage.uploadObject({
        bucket: 'public',
        key: `videos/${videoId}/hls/720p/index.m3u8`,
        body: Buffer.from('#EXTM3U\n'),
        contentType: 'application/vnd.apple.mpegurl',
      })
    );
    const uploaded: string[] = [];
    const upload = world.storage.uploadObject.bind(world.storage);
    vi.spyOn(world.storage, 'uploadObject').mockImplementation(async (options) => {
      uploaded.push(options.key);
      return upload(options);
    });

    const pkg = createPackageProcessor({ ...STAGE_SETTINGS, ...world });
    const masterKey = `videos/${videoId}/hls/master.m3u8`;
    expect(expectOk(await pkg(job())).masterKey).toBe(masterKey);
    expect(uploaded).toContain(masterKey);

    const video = expectOk(await world.repositories.videos.findById(videoId));
    expect(video?.status).toBe('READY');
    expect(video?.masterPlaylistKey).toBe(masterKey);
    expect(video?.readyAt).toBeDefined();

    const events = expectOk(await world.repositories.events.findByVideoId(videoId));
    expect(events.filter((event) => event.type === 'video.ready')).toHaveLength(1);

    expect(world.getQueue('notify').enqueuedJobs.map((notify) => notify.name)).toEqual(['notify']);
  });

  it('fails with SEGMENT_VERIFY_FAILED when a rendition playlist is missing from storage', async () => {
    const pkg = createPackageProcessor({ ...STAGE_SETTINGS, ...world });

    expect(expectErr(await pkg(job())).code).toBe(ErrorCodes.SEGMENT_VERIFY_FAILED);

    const steps = expectOk(await world.repositories.steps.findByVideoId(videoId));
    const step = steps.find((s) => s.step === 'package');
    expect(step?.errorCode).toBe(ErrorCodes.SEGMENT_VERIFY_FAILED);
  });
});
