import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ErrorCodes } from '@vp/errors';
import { parseChannelImageProbe, probeChannelImage } from '../channel-image-probe';

const still = (overrides: Record<string, unknown> = {}) => ({
  codec_type: 'video',
  codec_name: 'mjpeg',
  width: 800,
  height: 600,
  nb_read_frames: '1',
  ...overrides,
});

describe('@vp/ffmpeg: channel image probe', () => {
  it.each([
    { codec: 'mjpeg', format: 'jpeg' },
    { codec: 'png', format: 'png' },
    { codec: 'webp', format: 'webp' },
  ])('reads a $format still', ({ codec, format }) => {
    expect(parseChannelImageProbe({ streams: [still({ codec_name: codec })] })).toEqual({
      format,
      width: 800,
      height: 600,
    });
  });

  it.each([
    { name: 'a rotate tag', stream: { tags: { rotate: '90' } } },
    { name: 'a display matrix', stream: { side_data_list: [{ rotation: -270 }] } },
  ])('swaps the sides for $name', ({ stream }) => {
    expect(parseChannelImageProbe({ streams: [still(stream)] })).toMatchObject({
      width: 600,
      height: 800,
    });
  });

  it.each([
    {
      name: 'an ffprobe error',
      raw: { error: { string: 'Invalid data' } },
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    { name: 'no stream', raw: { streams: [] }, code: ErrorCodes.CORRUPT_CONTAINER },
    {
      name: 'an audio stream',
      raw: { streams: [still({ codec_type: 'audio' })] },
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      name: 'two streams',
      raw: { streams: [still(), still()] },
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      name: 'a video codec',
      raw: { streams: [still({ codec_name: 'h264' })] },
      code: ErrorCodes.UNSUPPORTED_CODEC,
    },
    {
      name: 'an animation',
      raw: { streams: [still({ codec_name: 'webp', nb_read_frames: '12' })] },
      code: ErrorCodes.UNSUPPORTED_CODEC,
    },
    {
      name: 'an edge past the cap',
      raw: { streams: [still({ width: 9000 })] },
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      name: 'more pixels than the cap',
      raw: { streams: [still({ width: 8000, height: 8000 })] },
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      name: 'no dimensions',
      raw: { streams: [still({ width: 0 })] },
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
  ])('rejects $name', ({ raw, code }) => {
    expect(() => parseChannelImageProbe(raw)).toThrow(expect.objectContaining({ code }));
  });

  describe('with the real ffprobe', () => {
    let dir: string;
    const options = { ffprobePath: 'ffprobe', timeoutMs: 20_000 };

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-image-probe-'));
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('reads a generated PNG and refuses bytes that are no image', async () => {
      const png = path.join(dir, 'a.png');
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=red:s=320x200',
        '-frames:v',
        '1',
        png,
      ]);
      const junk = path.join(dir, 'junk');
      fs.writeFileSync(junk, 'not an image at all');

      expect(await probeChannelImage(png, options)).toEqual({
        format: 'png',
        width: 320,
        height: 200,
      });
      await expect(probeChannelImage(junk, options)).rejects.toMatchObject({
        code: ErrorCodes.CORRUPT_CONTAINER,
      });
    });
  });
});
