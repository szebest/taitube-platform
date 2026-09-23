export const ENCODER = {
  ffmpegPath: 'ffmpeg',
  gopSeconds: 2,
  hlsSegmentSeconds: 6,
  timeoutFactor: 3,
} as const;

export const PROBE_LIMITS = { ffprobePath: 'ffprobe', maxDurationSec: 3600 } as const;
