import { spawn } from 'node:child_process';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { tryCatch } from '@vp/result';

export const MAX_CHANNEL_IMAGE_EDGE = 8192;
export const MAX_CHANNEL_IMAGE_PIXELS = 40_000_000;

export interface ChannelImageProbe {
  format: 'jpeg' | 'png' | 'webp';
  width: number;
  height: number;
}

export interface ChannelImageProbeOptions {
  ffprobePath: string;
  timeoutMs: number;
}

interface RawStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  nb_read_frames?: string;
  tags?: { rotate?: string | number };
  side_data_list?: { rotation?: number }[];
}

interface RawImageProbe {
  streams?: RawStream[];
  error?: { string?: string };
}

const FORMATS: Readonly<Record<string, ChannelImageProbe['format']>> = {
  mjpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
};

function rotationOf(stream: RawStream): number {
  const fromSideData = stream.side_data_list?.find((data) => typeof data.rotation === 'number');
  return fromSideData?.rotation ?? Number(stream.tags?.rotate ?? 0);
}

/**
 * The size is the one a viewer sees: a 90 degree turn in the tags swaps the sides, as the crop the
 * client drew did.
 */
export function parseChannelImageProbe(raw: RawImageProbe): ChannelImageProbe {
  if (raw.error) {
    throw new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      `ffprobe error: ${raw.error.string ?? 'unreadable file'}`
    );
  }
  const streams = raw.streams ?? [];
  const [stream] = streams;
  if (streams.length !== 1 || stream?.codec_type !== 'video') {
    throw new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'The file is not a single still image');
  }
  const format = FORMATS[stream.codec_name ?? ''];
  if (!format) {
    throw new PermanentError(
      ErrorCodes.UNSUPPORTED_CODEC,
      `Unsupported image codec "${stream.codec_name}"; allowed are JPEG, PNG and WebP`
    );
  }
  if (Number(stream.nb_read_frames ?? 1) !== 1) {
    throw new PermanentError(ErrorCodes.UNSUPPORTED_CODEC, 'Animated images are not supported');
  }

  const turned = Math.abs(rotationOf(stream)) % 180 === 90;
  const [width, height] = turned
    ? [stream.height ?? 0, stream.width ?? 0]
    : [stream.width ?? 0, stream.height ?? 0];
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_CHANNEL_IMAGE_EDGE ||
    height > MAX_CHANNEL_IMAGE_EDGE ||
    width * height > MAX_CHANNEL_IMAGE_PIXELS
  ) {
    throw new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      `Invalid image dimensions ${width}x${height}`
    );
  }
  return { format, width, height };
}

export async function probeChannelImage(
  sourcePath: string,
  { ffprobePath, timeoutMs }: ChannelImageProbeOptions
): Promise<ChannelImageProbe> {
  const args = [
    '-v',
    'error',
    '-print_format',
    'json',
    '-count_frames',
    '-show_entries',
    'stream=codec_type,codec_name,width,height,nb_read_frames:stream_tags=rotate:stream_side_data=rotation',
    '-show_error',
    '-i',
    sourcePath,
  ];

  return new Promise<ChannelImageProbe>((resolve, reject) => {
    const proc = spawn(ffprobePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    proc.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    proc.on('error', (cause) => {
      clearTimeout(timer);
      reject(
        new PermanentError(
          ErrorCodes.CORRUPT_CONTAINER,
          `Failed to execute ffprobe: ${cause.message}`
        )
      );
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new TransientError(ErrorCodes.FFMPEG_TIMEOUT, 'ffprobe exceeded its timeout'));
        return;
      }
      const output = Buffer.concat(stdout).toString('utf-8');
      if (!output.trim()) {
        const tail = Buffer.concat(stderr).toString('utf-8').slice(0, 500);
        reject(
          new PermanentError(
            ErrorCodes.CORRUPT_CONTAINER,
            `ffprobe produced no output. Exit code: ${code}. Stderr: ${tail}`
          )
        );
        return;
      }
      const parsed = tryCatch(
        () => parseChannelImageProbe(JSON.parse(output) as RawImageProbe),
        (cause) =>
          cause instanceof PermanentError
            ? cause
            : new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'ffprobe printed unreadable output')
      );
      if (parsed.ok) resolve(parsed.value);
      else reject(parsed.error);
    });
  });
}
