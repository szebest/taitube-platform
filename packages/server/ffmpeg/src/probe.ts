import { spawn } from 'node:child_process';
import { MS_PER_SECOND } from '@vp/domain/time';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { LadderEntry } from '@vp/job-contracts';
import { tryCatch } from '@vp/result';
import { selectLadder } from './ladder';

export interface RawStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  tags?: {
    rotate?: string | number;
    [key: string]: unknown;
  };
  side_data_list?: Array<{
    side_data_type?: string;
    rotation?: number;
    [key: string]: unknown;
  }>;
}

export interface RawFfprobeOutput {
  streams?: RawStream[];
  format?: {
    duration?: string;
    bit_rate?: string;
    size?: string;
  };
  error?: {
    code?: number;
    string?: string;
  };
}

export interface ProbeMetadata {
  durationMs: number;
  width: number;
  height: number;
  effectiveWidth: number;
  effectiveHeight: number;
  rotation: number;
  fps: number;
  videoCodec: string;
  audioCodec?: string;
  bitrateKbps: number;
  ladder: LadderEntry[];
}

const ALLOWED_INPUT_CODECS: ReadonlySet<string> = new Set(['h264', 'hevc', 'vp9', 'av1', 'mpeg4']);

/**
 * Parses rotation angle from ffprobe stream tags or display matrix side data.
 */
export function extractRotation(stream: RawStream): number {
  if (stream.side_data_list && Array.isArray(stream.side_data_list)) {
    const displayMatrix = stream.side_data_list.find(
      (sd) =>
        sd.side_data_type?.toLowerCase() === 'display matrix' || typeof sd.rotation === 'number'
    );
    if (displayMatrix && typeof displayMatrix.rotation === 'number') {
      return displayMatrix.rotation;
    }
  }

  if (stream.tags?.rotate !== undefined) {
    const rot = Number(stream.tags.rotate);
    if (!Number.isNaN(rot)) {
      return rot;
    }
  }

  return 0;
}

/**
 * Parses frame rate fraction (e.g. "24/1", "30000/1001") into numeric FPS.
 */
export function parseFps(rateStr?: string): number {
  if (!rateStr) return 24;
  const parts = rateStr.split('/');
  if (parts.length === 2) {
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (num > 0 && den > 0) {
      return Math.round((num / den) * 100) / 100;
    }
  }
  const direct = Number(rateStr);
  return Number.isFinite(direct) && direct > 0 ? direct : 24;
}

/**
 * Validates ffprobe output and computes video metadata according to SDD §8.1.
 */
export function validateAndParseProbe(
  raw: RawFfprobeOutput,
  maxDurationSec: number
): ProbeMetadata {
  if (raw.error) {
    throw new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      `ffprobe error: ${raw.error.string || 'corrupt file'}`
    );
  }

  const streams = raw.streams || [];
  const videoStream = streams.find((s) => s.codec_type === 'video');

  // Rule 1: No video stream (or audio-only) -> CORRUPT_CONTAINER (SDD §8.1, AC 18)
  if (!videoStream) {
    throw new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      'Source file contains no video stream (audio-only or empty container)'
    );
  }

  const codec = (videoStream.codec_name || '').toLowerCase();

  // Rule 2: Unsupported codec outside allowlist {h264, hevc, vp9, av1, mpeg4} (AC 18)
  if (!ALLOWED_INPUT_CODECS.has(codec)) {
    throw new PermanentError(
      ErrorCodes.UNSUPPORTED_CODEC,
      `Unsupported video codec "${codec}". Allowed input codecs are h264, hevc, vp9, av1, mpeg4.`
    );
  }

  const width = videoStream.width || 0;
  const height = videoStream.height || 0;

  // Rule 3: Dimensions must be valid (> 0 and <= 7680)
  if (width <= 0 || height <= 0 || width > 7680 || height > 7680) {
    throw new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      `Invalid video dimensions ${width}x${height}`
    );
  }

  // Rotation awareness (portrait videos swap width & height for ladder calculation)
  const rotation = extractRotation(videoStream);
  const isRotated = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
  const effectiveWidth = isRotated ? height : width;
  const effectiveHeight = isRotated ? width : height;

  // Rule 4: Duration validation
  const rawDuration = raw.format?.duration || videoStream.duration;
  const durationSec = rawDuration ? Number(rawDuration) : 0;
  const durationMs = Math.round(durationSec * MS_PER_SECOND);

  if (durationMs <= 0 || Number.isNaN(durationMs)) {
    throw new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'Invalid or missing video duration');
  }

  if (durationSec > maxDurationSec) {
    throw new PermanentError(
      ErrorCodes.DURATION_EXCEEDED,
      `Video duration ${Math.round(durationSec)}s exceeds maximum allowed duration of ${maxDurationSec}s`
    );
  }

  const fps = parseFps(videoStream.r_frame_rate || videoStream.avg_frame_rate);
  const bitrateKbps = raw.format?.bit_rate ? Math.round(Number(raw.format.bit_rate) / 1000) : 0;

  const audioStream = streams.find((s) => s.codec_type === 'audio');
  const audioCodec = audioStream?.codec_name;

  // Compute ladder (never upscaling, always keeping at least 480p)
  const ladder = selectLadder({ effectiveWidth, effectiveHeight });

  return {
    durationMs,
    width,
    height,
    effectiveWidth,
    effectiveHeight,
    rotation,
    fps,
    videoCodec: codec,
    audioCodec,
    bitrateKbps,
    ladder,
  };
}

/**
 * Runs ffprobe on a file path or URL and returns validated ProbeMetadata (SDD §8.1).
 */
export interface FfprobeOptions {
  ffprobePath: string;
  maxDurationSec: number;
}

export async function runFfprobe(
  targetPathOrUrl: string,
  { ffprobePath, maxDurationSec }: FfprobeOptions
): Promise<ProbeMetadata> {
  const args = [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    '-show_error',
    '-i',
    targetPathOrUrl,
  ];

  return new Promise<ProbeMetadata>((resolve, reject) => {
    const proc = spawn(ffprobePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on('data', (c) => stdoutChunks.push(Buffer.from(c)));
    proc.stderr.on('data', (c) => stderrChunks.push(Buffer.from(c)));

    proc.on('error', (err) => {
      reject(
        new PermanentError(
          ErrorCodes.CORRUPT_CONTAINER,
          `Failed to execute ffprobe: ${err.message}`
        )
      );
    });

    proc.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');

      if (!stdout.trim()) {
        reject(
          new PermanentError(
            ErrorCodes.CORRUPT_CONTAINER,
            `ffprobe produced no output. Exit code: ${code}. Stderr: ${stderr.slice(0, 500)}`
          )
        );
        return;
      }

      const parsed = tryCatch(
        () => validateAndParseProbe(JSON.parse(stdout) as RawFfprobeOutput, maxDurationSec),
        (cause) =>
          cause instanceof PermanentError
            ? cause
            : new PermanentError(
                ErrorCodes.CORRUPT_CONTAINER,
                `Failed to parse ffprobe output: ${(cause as Error).message}. Raw: ${stdout.slice(0, 300)}`
              )
      );
      if (parsed.ok) resolve(parsed.value);
      else reject(parsed.error);
    });
  });
}
