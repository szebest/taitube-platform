import { MS_PER_SECOND } from '@vp/domain/time';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { LadderEntry } from '@vp/job-contracts';
import { selectLadder } from './ladder';

interface RawStream {
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
function extractRotation(stream: RawStream): number {
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
function parseFps(rateStr?: string): number {
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

  if (!videoStream) {
    throw new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      'Source file contains no video stream (audio-only or empty container)'
    );
  }

  const codec = (videoStream.codec_name || '').toLowerCase();

  if (!ALLOWED_INPUT_CODECS.has(codec)) {
    throw new PermanentError(
      ErrorCodes.UNSUPPORTED_CODEC,
      `Unsupported video codec "${codec}". Allowed input codecs are h264, hevc, vp9, av1, mpeg4.`
    );
  }

  const width = videoStream.width || 0;
  const height = videoStream.height || 0;

  if (width <= 0 || height <= 0 || width > 7680 || height > 7680) {
    throw new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      `Invalid video dimensions ${width}x${height}`
    );
  }

  const rotation = extractRotation(videoStream);
  const isRotated = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
  const effectiveWidth = isRotated ? height : width;
  const effectiveHeight = isRotated ? width : height;

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
