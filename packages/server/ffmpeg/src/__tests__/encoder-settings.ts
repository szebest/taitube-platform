/** The encoder settings `.env.example` gives a local process: FFMPEG_PATH, GOP_SECONDS, HLS_SEGMENT_SECONDS. */
export const ENCODER = { ffmpegPath: 'ffmpeg', gopSeconds: 2, hlsSegmentSeconds: 6 } as const;

/** FFPROBE_PATH and MAX_DURATION_SEC at their `.env.example` values. */
export const PROBE_LIMITS = { ffprobePath: 'ffprobe', maxDurationSec: 3600 } as const;
