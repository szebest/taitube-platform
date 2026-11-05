import { ErrorCodes } from '@vp/errors';
import type { LlHlsSegment } from '@vp/ffmpeg';
import { expectOk } from '@vp/testing/result';
import { finalizeBroadcast } from '../live-finalize';
import { LiveUploader } from '../live-uploader';
import { BUCKET, LIVE, liveWorld, STREAM_ID, STREAM_KEY, VIDEO_ID } from './live-world';

const segment = (sequence: number): LlHlsSegment => ({
  sequence,
  discontinuity: 0,
  mapUri: '0/init.mp4',
  uri: `0/${sequence}.m4s`,
  durationMs: 2000,
  parts: [],
});

async function finalized(segments: LlHlsSegment[]) {
  const world = await liveWorld();
  const deps = {
    repositories: world.repositories,
    uploader: new LiveUploader(world.storage, BUCKET),
    packaging: LIVE.packaging,
    now: () => Date.parse('2026-03-01T13:00:00.000Z'),
  };
  expectOk(await finalizeBroadcast(deps, world.stream, { epochs: 1, segments }));
  const text = async (key: string) =>
    expectOk(await world.storage.getObject(BUCKET, `live/${STREAM_ID}/${key}`)).toString();
  const video = expectOk(await world.repositories.videos.findById(VIDEO_ID));
  return { ...world, deps, text, video };
}

describe('worker/live: finalizeBroadcast', () => {
  it('closes the archive and turns the video into it, at the archive visibility', async () => {
    const { text, video } = await finalized([segment(0), segment(1)]);

    expect(await text('archive.m3u8')).toMatch(/#EXT-X-ENDLIST\n$/);
    expect((await text('master.m3u8')).trimEnd().split('\n').at(-1)).toBe('archive.m3u8');
    expect(video).toMatchObject({
      status: 'READY',
      visibility: 'unlisted',
      durationMs: 4000,
      masterPlaylistKey: `live/${STREAM_ID}/master.m3u8`,
    });
  });

  it('ends the stream and hands its key to the next idle one', async () => {
    const { repositories } = await finalized([segment(0)]);

    expect(expectOk(await repositories.liveStreams.findById(STREAM_ID))?.status).toBe('ENDED');
    expect(expectOk(await repositories.liveStreams.findByKey(STREAM_KEY))?.status).toBe('IDLE');
  });

  it('fails the video of a broadcast that recorded nothing', async () => {
    const { video } = await finalized([]);

    expect(video).toMatchObject({
      status: 'FAILED',
      errorCode: ErrorCodes.LIVE_INGEST_UNAVAILABLE,
    });
  });

  it('finishes what an earlier run began when it runs again', async () => {
    const { deps, stream, video } = await finalized([segment(0)]);

    expectOk(await finalizeBroadcast(deps, stream, { epochs: 1, segments: [segment(0)] }));

    expect(video?.status).toBe('READY');
  });
});
