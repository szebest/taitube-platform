import * as path from 'node:path';
import { ErrorCodes } from '@vp/errors';
import { runFfprobe } from '../probe';
import { PROBE_LIMITS } from './encoder-settings';

const fixture = (name: string) => path.resolve(__dirname, '../../../../../tests/fixtures', name);

describe('@vp/ffmpeg: runFfprobe', () => {
  it('reads the metadata of a real source through ffprobe', async () => {
    const metadata = await runFfprobe(fixture('s60.mp4'), PROBE_LIMITS);

    expect(metadata).toMatchObject({
      durationMs: 60000,
      width: 1920,
      height: 1080,
      videoCodec: 'h264',
      audioCodec: 'aac',
    });
    expect(metadata.ladder.map((rung) => rung.name)).toEqual(['1080p', '720p', '480p']);
  });

  it.each([
    {
      label: 'a source longer than the limit',
      target: fixture('s60.mp4'),
      options: { ...PROBE_LIMITS, maxDurationSec: 10 },
      code: ErrorCodes.DURATION_EXCEEDED,
    },
    {
      label: 'a file that is not a video',
      target: fixture('not-a-video.mp4'),
      options: PROBE_LIMITS,
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      label: 'an ffprobe binary that does not exist',
      target: fixture('s60.mp4'),
      options: { ...PROBE_LIMITS, ffprobePath: '/nonexistent/ffprobe' },
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
  ])('rejects $label with $code', async ({ target, options, code }) => {
    await expect(runFfprobe(target, options)).rejects.toMatchObject({ code });
  });
});
