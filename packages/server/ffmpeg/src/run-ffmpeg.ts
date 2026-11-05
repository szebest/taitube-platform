import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ErrorCodes, TransientError } from '@vp/errors';
import { assertNever } from '@vp/result';
import { sanitizeStorageUrl } from '@vp/storage';
import { classifyFfmpegError } from './classify-ffmpeg-error';

/** How a run is policed: the grace a SIGTERM gets before SIGKILL, and how much stderr a failure keeps. */
export interface FfmpegProcessLimits {
  killGraceMs: number;
  stderrTailLines: number;
}

/** ffmpeg writes stdout only when asked: `-progress pipe:1` as text lines, or a muxer to `pipe:1` as bytes. */
type FfmpegStdout =
  | { type: 'lines'; onLine: (line: string) => void }
  | { type: 'bytes'; onChunk: (chunk: Uint8Array) => void };

export interface FfmpegRunOptions {
  ffmpegPath: string;
  limits: FfmpegProcessLimits;
  /** Names the span and the timeout message; one word, e.g. `transcode` or `thumbnail`. */
  stage: string;
  args: string[];
  timeoutMs: number;
  attributes?: Record<string, string>;
  /** Supplying this is what turns stdout on. */
  stdout?: FfmpegStdout;
  signal?: AbortSignal;
}

/** Any input URL can carry credentials (a presigned query, rtsp user info); a span never keeps them. */
function redactedArg(arg: string): string {
  return arg.includes('://') ? sanitizeStorageUrl(arg) : arg;
}

function redactedCommand(args: string[]): string {
  return ['ffmpeg', ...args.map(redactedArg)].join(' ');
}

function readStdout(stream: Readable, stdout: FfmpegStdout): void {
  switch (stdout.type) {
    case 'lines': {
      stream.setEncoding('utf-8');
      let buffered = '';
      stream.on('data', (chunk: string) => {
        buffered += chunk;
        const lines = buffered.split('\n');
        buffered = lines.pop() || '';
        for (const line of lines) {
          stdout.onLine(line.trim());
        }
      });
      return;
    }
    case 'bytes':
      stream.on('data', (chunk: Buffer) => stdout.onChunk(chunk));
      return;
    default:
      assertNever(stdout, 'stdout.type');
  }
}

/**
 * Runs ffmpeg under a traced span with a hard timeout, escalating SIGTERM to
 * SIGKILL, and rejects with the classified error built from the stderr tail.
 */
export function runFfmpeg(options: FfmpegRunOptions): Promise<void> {
  const { ffmpegPath, stage, args, timeoutMs, stdout, limits, signal } = options;

  const span = trace.getTracer('video-pipeline').startSpan('ffmpeg', {
    attributes: {
      'ffmpeg.stage': stage,
      'ffmpeg.command': redactedCommand(args),
      ...options.attributes,
    },
  });
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, {
      stdio: ['ignore', stdout ? 'pipe' : 'ignore', 'pipe'],
    });

    const stderrLines: string[] = [];
    let stopped: 'timeout' | 'aborted' | undefined;
    let exited = false;
    proc.once('exit', () => {
      exited = true;
    });

    const stop = (reason: 'timeout' | 'aborted'): void => {
      stopped ??= reason;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!exited) proc.kill('SIGKILL');
      }, limits.killGraceMs);
    };
    const abort = () => stop('aborted');
    const timer = setTimeout(() => stop('timeout'), timeoutMs);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });

    if (stdout && proc.stdout) readStdout(proc.stdout, stdout);

    proc.stderr?.setEncoding('utf-8');
    proc.stderr?.on('data', (chunk: string) => {
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        stderrLines.push(line.trim());
        if (stderrLines.length > limits.stderrTailLines) {
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
      signal?.removeEventListener('abort', abort);
      span.setAttribute('ffmpeg.duration_ms', Date.now() - startTime);
      fail(err);
    });

    proc.on('close', (code, exitSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      span.setAttribute('ffmpeg.exit_code', code ?? (exitSignal ? -1 : 0));
      span.setAttribute('ffmpeg.duration_ms', Date.now() - startTime);
      if (exitSignal) {
        span.setAttribute('ffmpeg.signal', exitSignal);
      }

      if (stopped === 'timeout') {
        return fail(
          new TransientError(
            ErrorCodes.FFMPEG_TIMEOUT,
            `FFmpeg ${stage} exceeded hard timeout of ${timeoutMs}ms`
          )
        );
      }
      if (stopped === 'aborted') {
        return fail(new TransientError(ErrorCodes.FFMPEG_FAILED, `FFmpeg ${stage} was aborted`));
      }

      if (code !== 0) {
        return fail(classifyFfmpegError(code, exitSignal, stderrLines.join('\n')));
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      resolve();
    });
  });
}
