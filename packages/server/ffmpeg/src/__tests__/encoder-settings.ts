export const LIMITS = { killGraceMs: 3_000, stderrTailLines: 50 } as const;

export const ENCODER = {
  ffmpegPath: 'ffmpeg',
  gopSeconds: 2,
  hlsSegmentSeconds: 6,
  timeoutFactor: 3,
  minTimeoutMs: 600_000,
  durationMs: 60_000,
  limits: LIMITS,
} as const;

export const SPRITE = { intervalSec: 5, columns: 10, tileWidth: 160, tileHeight: 90 } as const;

export const PROBE_LIMITS = { ffprobePath: 'ffprobe', maxDurationSec: 3600 } as const;
