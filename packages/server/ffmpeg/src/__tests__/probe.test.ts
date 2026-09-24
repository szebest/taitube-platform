import { type ErrorCode, ErrorCodes, PermanentError } from '@vp/errors';
import { type RawFfprobeOutput, type RawStream, validateAndParseProbe } from '../index';
import { PROBE_LIMITS } from './encoder-settings';

function videoProbe(stream: RawStream, duration: string): RawFfprobeOutput {
  return {
    streams: [{ codec_type: 'video', codec_name: 'h264', ...stream }],
    format: { duration },
  };
}

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err: unknown) {
    return err;
  }
  return expect.unreachable();
}

describe('ffmpeg probe and ladder selection', () => {
  it('selects the full ladder [1080p, 720p, 480p] for a 1080p source', () => {
    const raw = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          r_frame_rate: '24/1',
        },
        {
          codec_type: 'audio',
          codec_name: 'aac',
        },
      ],
      format: {
        duration: '60.000',
        bit_rate: '5000000',
      },
    };

    const res = validateAndParseProbe(raw, PROBE_LIMITS.maxDurationSec);
    expect(res.durationMs).toBe(60000);
    expect(res.fps).toBe(24);
    expect(res.videoCodec).toBe('h264');
    expect(res.effectiveWidth).toBe(1920);
    expect(res.effectiveHeight).toBe(1080);
    expect(res.ladder.map((r) => r.name)).toEqual(['1080p', '720p', '480p']);
  });

  it.each([
    { label: '720p', width: 1280, height: 720, fps: '30/1', duration: '30.000', ladder: ['720p', '480p'] },
    {
      label: '360p (keeps the smallest rung, never upscales)',
      width: 640,
      height: 360,
      fps: '25/1',
      duration: '15.000',
      ladder: ['480p'],
    },
  ])('selects $ladder for a $label source', ({ width, height, fps, duration, ladder }) => {
    const raw = videoProbe({ width, height, r_frame_rate: fps }, duration);

    const res = validateAndParseProbe(raw, PROBE_LIMITS.maxDurationSec);
    expect(res.ladder.map((r) => r.name)).toEqual(ladder);
  });

  it('swaps width and height for a portrait video rotated 90°', () => {
    const raw = videoProbe(
      { width: 1920, height: 1080, tags: { rotate: '90' }, r_frame_rate: '24/1' },
      '10.000'
    );

    const res = validateAndParseProbe(raw, PROBE_LIMITS.maxDurationSec);
    expect(res.rotation).toBe(90);
    expect(res.effectiveWidth).toBe(1080);
    expect(res.effectiveHeight).toBe(1920);
    expect(res.ladder.map((r) => r.name)).toEqual(['1080p', '720p', '480p']);
  });

  it('accepts HEVC as an input codec', () => {
    const raw = videoProbe(
      { codec_name: 'hevc', width: 1920, height: 1080, r_frame_rate: '24/1' },
      '10.000'
    );

    const res = validateAndParseProbe(raw, PROBE_LIMITS.maxDurationSec);
    expect(res.videoCodec).toBe('hevc');
    expect(res.ladder.length).toBe(3);
  });

  it.each<{ label: string; raw: RawFfprobeOutput; maxDurationSec: number; code: ErrorCode }>([
    {
      label: 'a container with no video stream',
      raw: { streams: [{ codec_type: 'audio', codec_name: 'aac' }], format: { duration: '10.000' } },
      maxDurationSec: PROBE_LIMITS.maxDurationSec,
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      label: 'an unsupported video codec (prores)',
      raw: videoProbe({ codec_name: 'prores', width: 1920, height: 1080 }, '10.000'),
      maxDurationSec: PROBE_LIMITS.maxDurationSec,
      code: ErrorCodes.UNSUPPORTED_CODEC,
    },
    {
      label: 'a video longer than the limit',
      raw: videoProbe({ width: 1920, height: 1080 }, '10000.000'),
      maxDurationSec: 7200,
      code: ErrorCodes.DURATION_EXCEEDED,
    },
    {
      label: 'zero dimensions and zero duration',
      raw: videoProbe({ width: 0, height: 0 }, '0'),
      maxDurationSec: PROBE_LIMITS.maxDurationSec,
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
  ])('rejects $label with $code', ({ raw, maxDurationSec, code }) => {
    const err = thrownBy(() => validateAndParseProbe(raw, maxDurationSec));

    expect(err).toBeInstanceOf(PermanentError);
    expect((err as PermanentError).code).toBe(code);
  });
});
