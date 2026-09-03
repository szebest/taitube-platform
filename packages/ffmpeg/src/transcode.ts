import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import type { LadderEntry } from '@vp/job-contracts';

export interface TranscodeOptions {
  sourcePath: string;
  outputDir: string;
  rendition: LadderEntry;
  fps: number;
  durationMs?: number;
  threads?: number;
  preset?: string;
  timeoutMs?: number;
  onProgress?: (progress: { percent: number; outTimeMs: number }) => void;
}

export interface TranscodeExecutionResult {
  outputDir: string;
  playlistPath: string;
  segmentCount: number;
  durationMs: number;
}

/**
 * Builds the exact FFmpeg argument array according to SDD §8.2.
 */
export function buildTranscodeArgs(options: TranscodeOptions): string[] {
  const {
    sourcePath,
    outputDir,
    rendition,
    fps,
    threads = Number(process.env.FFMPEG_THREADS || '0'),
    preset = process.env.X264_PRESET || 'veryfast',
  } = options;

  // SDD §8.2 & AC 18: GOP = round(2 * fps)
  const gop = Math.max(1, Math.round(2 * fps));
  const segmentFilename = path.join(outputDir, 'seg_%05d.ts');
  const playlistFilename = path.join(outputDir, 'index.m3u8');

  const args: string[] = [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-progress',
    'pipe:1',
    '-i',
    sourcePath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    `scale=w=${rendition.width}:h=${rendition.height}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-profile:v',
    rendition.profile,
    '-level',
    rendition.level,
    '-pix_fmt',
    'yuv420p',
    '-b:v',
    `${rendition.videoKbps}k`,
    '-maxrate',
    `${rendition.maxrateKbps}k`,
    '-bufsize',
    `${rendition.bufsizeKbps}k`,
    '-g',
    String(gop),
    '-keyint_min',
    String(gop),
    '-sc_threshold',
    '0',
    '-force_key_frames',
    'expr:gte(t,n_forced*2)',
    '-c:a',
    'aac',
    '-b:a',
    `${rendition.audioKbps}k`,
    '-ac',
    '2',
    '-ar',
    '48000',
    '-f',
    'hls',
    '-hls_time',
    '6',
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments+temp_file',
    '-hls_segment_type',
    'mpegts',
    '-hls_segment_filename',
    segmentFilename,
  ];

  if (threads > 0) {
    args.push('-threads', String(threads));
  }

  args.push(playlistFilename);
  return args;
}

/**
 * Classifies an FFmpeg failure into PermanentError vs TransientError (SDD §9.5, §9.6, ADR-18, AC 23).
 */
export function classifyFfmpegError(
  exitCode: number | null,
  signal: string | null,
  stderr: string
): Error {
  const lowerStderr = stderr.toLowerCase();

  // Exit 137 = SIGKILL / OOM (AC 23)
  if (exitCode === 137 || signal === 'SIGKILL') {
    return new TransientError(
      ErrorCodes.FFMPEG_OOM,
      `FFmpeg killed due to Out-Of-Memory (exit 137 / SIGKILL): ${stderr.slice(-300)}`
    );
  }

  // Timeout (AC 23)
  if (signal === 'SIGTERM' || signal === 'SIGALRM') {
    return new TransientError(
      ErrorCodes.FFMPEG_TIMEOUT,
      `FFmpeg process timed out: ${stderr.slice(-300)}`
    );
  }

  // Corrupt container / invalid input data (AC 23)
  if (
    lowerStderr.includes('invalid data found when processing input') ||
    lowerStderr.includes('could not find codec parameters') ||
    lowerStderr.includes('moov atom not found')
  ) {
    return new PermanentError(
      ErrorCodes.CORRUPT_CONTAINER,
      `FFmpeg failed to decode input container: ${stderr.slice(-300)}`
    );
  }

  // Default pipeline error (transient for general transcoding failures, allows BullMQ retry)
  return new TransientError(
    ErrorCodes.FFMPEG_FAILED,
    `FFmpeg transcode failed (exit code ${exitCode}, signal ${signal}): ${stderr.slice(-300)}`
  );
}

/**
 * Runs FFmpeg to transcode one rendition to HLS TS segments with progress and error classification.
 */
export async function runFfmpegTranscode(
  options: TranscodeOptions
): Promise<TranscodeExecutionResult> {
  const args = buildTranscodeArgs(options);

  // Compute hard per-job timeout: max(3 * durationMs, 10 min) (SDD §9.5)
  const durationMs = options.durationMs || 60000;
  const timeoutMs = options.timeoutMs || Math.max(3 * durationMs, 10 * 60 * 1000);

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stderrLines: string[] = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 3000);
    }, timeoutMs);

    proc.stdout.setEncoding('utf-8');
    let buffer = '';

    proc.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('out_time_ms=')) {
          const val = Number.parseInt(trimmed.slice('out_time_ms='.length), 10);
          if (!Number.isNaN(val) && val > 0) {
            const outMs = Math.round(val / 1000);
            const percent = Math.min(100, Math.round((outMs / durationMs) * 100));
            options.onProgress?.({ percent, outTimeMs: outMs });
          }
        } else if (trimmed.startsWith('out_time_us=')) {
          const val = Number.parseInt(trimmed.slice('out_time_us='.length), 10);
          if (!Number.isNaN(val) && val > 0) {
            const outMs = Math.round(val / 1000);
            const percent = Math.min(100, Math.round((outMs / durationMs) * 100));
            options.onProgress?.({ percent, outTimeMs: outMs });
          }
        }
      }
    });

    proc.stderr.setEncoding('utf-8');
    proc.stderr.on('data', (chunk: string) => {
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          stderrLines.push(line.trim());
          if (stderrLines.length > 50) {
            stderrLines.shift(); // Keep last 50 lines per ticket notes
          }
        }
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code, signal) => {
      clearTimeout(timer);

      if (timedOut) {
        return reject(
          new TransientError(
            ErrorCodes.FFMPEG_TIMEOUT,
            `FFmpeg exceeded hard timeout of ${timeoutMs}ms`
          )
        );
      }

      if (code !== 0) {
        const stderrStr = stderrLines.join('\n');
        const classified = classifyFfmpegError(code, signal, stderrStr);
        return reject(classified);
      }

      resolve({
        outputDir: options.outputDir,
        playlistPath: path.join(options.outputDir, 'index.m3u8'),
        segmentCount: 0,
        durationMs,
      });
    });
  });
}
