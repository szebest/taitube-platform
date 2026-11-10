import { type FfmpegProcessLimits, runFfmpeg } from '@vp/ffmpeg';

export interface EvidenceFrameOptions {
  ffmpegPath: string;
  sourcePath: string;
  timestampSeconds: number;
  /** Width of the JPEG; the height follows the source's aspect ratio. */
  widthPixels: number;
  timeoutMs: number;
  limits: FfmpegProcessLimits;
  signal?: AbortSignal;
}

/** A small JPEG of the frame at a moment, for a moderator to see why a video was held. */
function buildEvidenceFrameArgs(
  options: Pick<EvidenceFrameOptions, 'sourcePath' | 'timestampSeconds' | 'widthPixels'>
): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-ss',
    String(options.timestampSeconds),
    '-i',
    options.sourcePath,
    '-an',
    '-sn',
    '-frames:v',
    '1',
    '-vf',
    `scale=${options.widthPixels}:-2`,
    '-q:v',
    '5',
    '-f',
    'image2pipe',
    '-c:v',
    'mjpeg',
    'pipe:1',
  ];
}

export async function extractEvidenceFrame(options: EvidenceFrameOptions): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  await runFfmpeg({
    ffmpegPath: options.ffmpegPath,
    limits: options.limits,
    signal: options.signal,
    stage: 'screen-evidence',
    args: buildEvidenceFrameArgs(options),
    timeoutMs: options.timeoutMs,
    stdout: { type: 'bytes', onChunk: (chunk) => chunks.push(Uint8Array.from(chunk)) },
  });
  return Buffer.concat(chunks);
}
