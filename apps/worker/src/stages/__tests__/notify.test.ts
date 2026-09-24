import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { createLogger } from '@vp/logger';
import { ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { OWNER_ID } from '../../__tests__/flow-harness';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createNotifyProcessor } from '../notify';

describe('apps/worker/stages: notify', () => {
  it('publishes the READY status with its playback URL on the video and the owner channels', async () => {
    const repositories = new InMemoryRepositories();
    const cache = new InMemoryCacheClient();
    const videoId = uuidv7();
    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_ID,
        title: 'Notify Video',
        status: 'PROCESSING',
        sourceKey: 'raw/notify-test.mp4',
      })
    );
    const playbackUrl = `http://localhost:9000/public/videos/${videoId}/hls/master.m3u8`;
    const published: Array<{ channel: string; message: unknown }> = [];
    vi.spyOn(cache, 'publish').mockImplementation(async (channel: string, message: string) => {
      published.push({ channel, message: JSON.parse(message) });
      return ok(1);
    });

    const notify = createNotifyProcessor({
      workerId: STAGE_SETTINGS.workerId,
      repositories,
      cache,
      logger: createLogger({ format: 'json', service: 'notify-spec', level: 'silent' }),
      metrics: STAGE_SETTINGS.metrics,
    });
    const result = await notify({
      id: `${videoId}--notify--video.ready--1`,
      name: 'notify',
      data: {
        videoId,
        userId: OWNER_ID,
        event: 'video.ready',
        eventSeq: 1,
        payload: { status: 'READY', playbackUrl },
        traceparent: '00-01-01-01',
      },
      attemptsMade: 0,
    });

    expect(expectOk(result).published).toBe(true);
    const status = {
      event: 'status',
      data: expect.objectContaining({ status: 'READY', playbackUrl }),
    };
    expect(published).toHaveLength(2);
    expect(published).toEqual(
      expect.arrayContaining([
        { channel: `video:${videoId}`, message: expect.objectContaining(status) },
        { channel: `user:${OWNER_ID}`, message: expect.objectContaining(status) },
      ])
    );

    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    expect(steps.find((s) => s.step === 'notify')?.status).toBe('DONE');
  });
});
