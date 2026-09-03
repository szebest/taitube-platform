import { ErrorCodes, PermanentError } from '@vp/errors';
import { describe, expect, it } from 'vitest';
import { validateAndParseProbe } from '../index.js';

describe('packages/ffmpeg probe & ladder selection (AC 17, AC 18)', () => {
  it('AC 17: s60 1080p video selects full ladder [1080p, 720p, 480p]', () => {
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

    const res = validateAndParseProbe(raw);
    expect(res.durationMs).toBe(60000);
    expect(res.fps).toBe(24);
    expect(res.videoCodec).toBe('h264');
    expect(res.effectiveWidth).toBe(1920);
    expect(res.effectiveHeight).toBe(1080);
    expect(res.ladder.map((r) => r.name)).toEqual(['1080p', '720p', '480p']);
  });

  it('AC 17: p720 video selects ladder [720p, 480p]', () => {
    const raw = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1280,
          height: 720,
          r_frame_rate: '30/1',
        },
      ],
      format: {
        duration: '30.000',
      },
    };

    const res = validateAndParseProbe(raw);
    expect(res.ladder.map((r) => r.name)).toEqual(['720p', '480p']);
  });

  it('AC 17: sd360 video selects ladder [480p] (keeps smallest rung, never upscales)', () => {
    const raw = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 640,
          height: 360,
          r_frame_rate: '25/1',
        },
      ],
      format: {
        duration: '15.000',
      },
    };

    const res = validateAndParseProbe(raw);
    expect(res.ladder.map((r) => r.name)).toEqual(['480p']);
  });

  it('AC 17: portrait video with 90° rotation is rotation-aware (swaps width/height for ladder)', () => {
    const raw = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          tags: {
            rotate: '90',
          },
          r_frame_rate: '24/1',
        },
      ],
      format: {
        duration: '10.000',
      },
    };

    const res = validateAndParseProbe(raw);
    expect(res.rotation).toBe(90);
    expect(res.effectiveWidth).toBe(1080);
    expect(res.effectiveHeight).toBe(1920);
    expect(res.ladder.map((r) => r.name)).toEqual(['1080p', '720p', '480p']);
  });

  it('AC 18: HEVC codec is supported as input', () => {
    const raw = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'hevc',
          width: 1920,
          height: 1080,
          r_frame_rate: '24/1',
        },
      ],
      format: {
        duration: '10.000',
      },
    };

    const res = validateAndParseProbe(raw);
    expect(res.videoCodec).toBe('hevc');
    expect(res.ladder.length).toBe(3);
  });

  it('AC 18: audio-only or container with no video stream throws CORRUPT_CONTAINER', () => {
    const raw = {
      streams: [
        {
          codec_type: 'audio',
          codec_name: 'aac',
        },
      ],
      format: {
        duration: '10.000',
      },
    };

    expect(() => validateAndParseProbe(raw)).toThrowError(PermanentError);
    try {
      validateAndParseProbe(raw);
    } catch (err: unknown) {
      expect((err as PermanentError).code).toBe(ErrorCodes.CORRUPT_CONTAINER);
    }
  });

  it('AC 18: unsupported video codec (e.g. prores) throws UNSUPPORTED_CODEC', () => {
    const raw = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'prores',
          width: 1920,
          height: 1080,
        },
      ],
      format: {
        duration: '10.000',
      },
    };

    try {
      validateAndParseProbe(raw);
      expect.unreachable();
    } catch (err: unknown) {
      expect((err as PermanentError).code).toBe(ErrorCodes.UNSUPPORTED_CODEC);
    }
  });

  it('AC 18: over-duration video throws DURATION_EXCEEDED', () => {
    const raw = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
        },
      ],
      format: {
        duration: '10000.000', // Exceeds 7200s
      },
    };

    try {
      validateAndParseProbe(raw, 7200);
      expect.unreachable();
    } catch (err: unknown) {
      expect((err as PermanentError).code).toBe(ErrorCodes.DURATION_EXCEEDED);
    }
  });

  it('AC 18: corrupt/missing dimensions or zero duration throws CORRUPT_CONTAINER', () => {
    const raw = {
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 0,
          height: 0,
        },
      ],
      format: {
        duration: '0',
      },
    };

    try {
      validateAndParseProbe(raw);
      expect.unreachable();
    } catch (err: unknown) {
      expect((err as PermanentError).code).toBe(ErrorCodes.CORRUPT_CONTAINER);
    }
  });
});
