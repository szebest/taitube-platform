import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import type { LadderEntry } from '@vp/job-contracts';

export interface TranscodeOptions {
  sourcePath: string;
  outputDir: string;
  rendition: LadderEntry;
  fps: number;
  durationMs?: number;
  threads?: number;
  attempt?: number;
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
 * Computes the number of threads for FFmpeg based on base threads and retry attempt (SDD §9.6 rule 6, Ticket 14 AC 3).
 * Attempt 1: FFMPEG_THREADS
 * Attempt 2: FFMPEG_THREADS - 1
 * Attempt >= FFMPEG_THREADS: 1
 */
export function computeFfmpegThreads(baseThreads: number, attempt = 1): number {
  const effectiveBase = baseThreads > 0 ? baseThreads : 2;
  const computed = effectiveBase - (attempt - 1);
  return Math.max(1, computed);
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
    preset = process.env.X264_PRESET || 'veryfast',
  } = options;

  const baseThreads =
    options.threads !== undefined ? options.threads : Number(process.env.FFMPEG_THREADS || '0');

  const threads =
    options.attempt !== undefined
      ? computeFfmpegThreads(baseThreads, options.attempt)
      : baseThreads;

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
    '-fps_mode',
    'cfr',
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
 * Classifies an FFmpeg failure into PermanentError vs TransientError (SDD §9.5, §9.6, ADR-18, AC 23, Ticket 14 AC 6).
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

  // Disk exhaustion (Ticket 14 AC 6)
  if (
    lowerStderr.includes('no space left on device') ||
    lowerStderr.includes('enospc') ||
    lowerStderr.includes('disk full')
  ) {
    return new TransientError(
      ErrorCodes.DISK_FULL,
      `Disk full during FFmpeg transcode: ${stderr.slice(-300)}`,
      { hint: 'DISK_FULL' }
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

export interface FfmpegRunOptions {
  /** Names the span and the timeout message; one word, e.g. `transcode` or `thumbnail`. */
  stage: string;
  args: string[];
  timeoutMs: number;
  attributes?: Record<string, string>;
  /** Supplying this is what turns stdout on; ffmpeg only writes there under `-progress`. */
  onStdoutLine?: (line: string) => void;
}

/** ffmpeg reports both of these in microseconds, whatever the suffix says. */
const PROGRESS_TIME_KEYS = ['out_time_ms=', 'out_time_us='] as const;

const STDERR_TAIL_LINES = 50;
const KILL_GRACE_MS = 3000;

function redactedCommand(args: string[]): string {
  return [
    'ffmpeg',
    ...args.map((arg) => {
      try {
        if (arg.startsWith('http://') || arg.startsWith('https://')) {
          const url = new URL(arg);
          url.search = '';
          return url.toString();
        }
      } catch {}
      return arg;
    }),
  ].join(' ');
}

/**
 * Runs ffmpeg under a traced span with a hard timeout, escalating SIGTERM to
 * SIGKILL, and rejects with the classified error built from the stderr tail.
 */
export function runFfmpeg(options: FfmpegRunOptions): Promise<void> {
  const { stage, args, timeoutMs, onStdoutLine } = options;

  const span = trace.getTracer('video-pipeline').startSpan('ffmpeg', {
    attributes: {
      'ffmpeg.stage': stage,
      'ffmpeg.command': redactedCommand(args),
      ...options.attributes,
    },
  });
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      stdio: ['ignore', onStdoutLine ? 'pipe' : 'ignore', 'pipe'],
    });

    const stderrLines: string[] = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, KILL_GRACE_MS);
    }, timeoutMs);

    if (onStdoutLine && proc.stdout) {
      proc.stdout.setEncoding('utf-8');
      let buffered = '';
      proc.stdout.on('data', (chunk: string) => {
        buffered += chunk;
        const lines = buffered.split('\n');
        buffered = lines.pop() || '';
        for (const line of lines) {
          onStdoutLine(line.trim());
        }
      });
    }

    proc.stderr?.setEncoding('utf-8');
    proc.stderr?.on('data', (chunk: string) => {
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        stderrLines.push(line.trim());
        if (stderrLines.length > STDERR_TAIL_LINES) {
          stderrLines.shift();
        }
      }
    });

    const fail = (err: Error): void => {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.end();
      reject(err);
    };

    proc.on('error', (err) => {
      clearTimeout(timer);
      span.setAttribute('ffmpeg.duration_ms', Date.now() - startTime);
      fail(err);
    });

    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      span.setAttribute('ffmpeg.exit_code', code ?? (signal ? -1 : 0));
      span.setAttribute('ffmpeg.duration_ms', Date.now() - startTime);
      if (signal) {
        span.setAttribute('ffmpeg.signal', signal);
      }

      if (timedOut) {
        return fail(
          new TransientError(
            ErrorCodes.FFMPEG_TIMEOUT,
            `FFmpeg ${stage} exceeded hard timeout of ${timeoutMs}ms`
          )
        );
      }

      if (code !== 0) {
        return fail(classifyFfmpegError(code, signal, stderrLines.join('\n')));
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      resolve();
    });
  });
}

/**
 * Runs FFmpeg to transcode one rendition to HLS TS segments with progress and error classification.
 */
export async function runFfmpegTranscode(
  options: TranscodeOptions
): Promise<TranscodeExecutionResult> {
  const durationMs = options.durationMs || 60000;
  const timeoutMs = options.timeoutMs || Math.max(3 * durationMs, 10 * 60 * 1000);

  await runFfmpeg({
    stage: 'transcode',
    args: buildTranscodeArgs(options),
    timeoutMs,
    attributes: {
      'ffmpeg.rendition': options.rendition.name,
      rendition: options.rendition.name,
    },
    onStdoutLine: (line) => {
      const prefix = PROGRESS_TIME_KEYS.find((key) => line.startsWith(key));
      if (!prefix) return;
      const microseconds = Number.parseInt(line.slice(prefix.length), 10);
      if (Number.isNaN(microseconds) || microseconds <= 0) return;
      const outTimeMs = Math.round(microseconds / 1000);
      options.onProgress?.({
        percent: Math.min(100, Math.round((outTimeMs / durationMs) * 100)),
        outTimeMs,
      });
    },
  });

  return {
    outputDir: options.outputDir,
    playlistPath: path.join(options.outputDir, 'index.m3u8'),
    segmentCount: 0,
    durationMs,
  };
}
