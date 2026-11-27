import { ErrorCodes } from '@vp/errors';
import { parseChannelImageProbe } from '../parse-channel-image-probe';

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
});
