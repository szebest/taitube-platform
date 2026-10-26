import type { MediaTools } from '@vp/ffmpeg';
import { CANONICAL_LADDER, type TranscodeJob } from '@vp/job-contracts';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { encodeRendition } from '../encode-rendition';

const data: TranscodeJob = {
  videoId: '0197a000-0000-7000-8000-000000000001',
  sourceKey: 'raw/source.mp4',
  generation: 1,
  rendition: CANONICAL_LADDER[1],
  fps: 24,
  durationMs: 60_000,
  traceparent: '00-01',
};

describe('apps/server/worker/stages: encode rendition', () => {
  const run = (chunkList: string | undefined) => {
    const transcode = vi.fn<MediaTools['transcode']>();
    const concat = vi.fn<MediaTools['concat']>();
    const media: MediaTools = { ...STAGE_SETTINGS.media, transcode, concat };
    const done = encodeRendition({
      media,
      data,
      ffmpeg: STAGE_SETTINGS.ffmpeg,
      source: 'https://storage.test/source.mp4',
      outputDir: '/tmp/hls',
      chunkList,
      threads: 2,
      attempt: 1,
      signal: new AbortController().signal,
      onProgress: () => {},
    });
    return { transcode, concat, done };
  };

  it('transcodes the source when the rendition has no chunks', async () => {
    const { transcode, concat, done } = run(undefined);
    await done;

    expect(transcode).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePath: 'https://storage.test/source.mp4', fps: 24 })
    );
    expect(concat).not.toHaveBeenCalled();
  });

  it('joins the chunks with the audio of the source when it has them', async () => {
    const { transcode, concat, done } = run('/tmp/chunks.txt');
    await done;

    expect(concat).toHaveBeenCalledWith(
      expect.objectContaining({
        listPath: '/tmp/chunks.txt',
        audioSourcePath: 'https://storage.test/source.mp4',
      })
    );
    expect(transcode).not.toHaveBeenCalled();
  });
});
