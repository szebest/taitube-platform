import { classifyVideoFormat } from '../classify-video-format.rule';

describe('@vp/domain-rules: classifyVideoFormat', () => {
  it.each([
    {
      name: 'a 9:16 video of 45 seconds',
      shape: { width: 1080, height: 1920, durationMs: 45_000 },
      format: 'short',
    },
    {
      name: 'a 16:9 video of 45 seconds',
      shape: { width: 1920, height: 1080, durationMs: 45_000 },
      format: 'standard',
    },
    {
      name: 'a portrait video of 4 minutes',
      shape: { width: 1080, height: 1920, durationMs: 240_000 },
      format: 'standard',
    },
    {
      name: 'a square video',
      shape: { width: 1080, height: 1080, durationMs: 30_000 },
      format: 'standard',
    },
    {
      name: 'a portrait video of exactly 180 seconds',
      shape: { width: 1080, height: 1920, durationMs: 180_000 },
      format: 'short',
    },
    {
      name: 'a portrait video of 180001 ms',
      shape: { width: 1080, height: 1920, durationMs: 180_001 },
      format: 'standard',
    },
    {
      name: 'a video without dimensions',
      shape: { width: null, height: null, durationMs: 30_000 },
      format: 'standard',
    },
    {
      name: 'a video without a height',
      shape: { width: 1080, durationMs: 30_000 },
      format: 'standard',
    },
    {
      name: 'a video without a duration',
      shape: { width: 1080, height: 1920, durationMs: null },
      format: 'standard',
    },
  ])('classifies $name as $format', ({ shape, format }) => {
    expect(classifyVideoFormat(shape)).toBe(format);
  });
});
