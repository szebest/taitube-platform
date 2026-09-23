import { spawn } from 'node:child_process';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { tryCatch, unwrapOr } from '@vp/result';

/**
 * Classifies an FFmpeg failure into PermanentError vs TransientError (SDD §9.5, §9.6, ADR-18).
 */
export function classifyFfmpegError(
  exitCode: number | null,
  signal: string | null,
  stderr: string
): Error {
  const lowerStderr = stderr.toLowerCase();

  // Exit 137 is the kernel's OOM kill.
  if (exitCode === 137 || signal === 'SIGKILL') {
    return new TransientError(
      ErrorCodes.FFMPEG_OOM,
      `FFmpeg killed due to Out-Of-Memory (exit 137 / SIGKILL): ${stderr.slice(-300)}`
    );
  }

  if (signal === 'SIGTERM' || signal === 'SIGALRM') {
    return new TransientError(
      ErrorCodes.FFMPEG_TIMEOUT,
      `FFmpeg process timed out: ${stderr.slice(-300)}`
    );
  }

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

  return new TransientError(
    ErrorCodes.FFMPEG_FAILED,
    `FFmpeg transcode failed (exit code ${exitCode}, signal ${signal}): ${stderr.slice(-300)}`
  );
}

/** How a run is policed: the grace a SIGTERM gets before SIGKILL, and how much stderr a failure keeps. */
export interface FfmpegProcessLimits {
  killGraceMs: number;
  stderrTailLines: number;
}

export interface FfmpegRunOptions {
  ffmpegPath: string;
  limits: FfmpegProcessLimits;
  /** Names the span and the timeout message; one word, e.g. `transcode` or `thumbnail`. */
  stage: string;
  args: string[];
  timeoutMs: number;
  attributes?: Record<string, string>;
  /** Supplying this is what turns stdout on; ffmpeg only writes there under `-progress`. */
  onStdoutLine?: (line: string) => void;
  signal?: AbortSignal;
}

/** A presigned input URL carries its credentials in the query string, so a span never keeps it. */
function redactedArg(arg: string): string {
  if (!(arg.startsWith('http://') || arg.startsWith('https://'))) return arg;
  const redacted = tryCatch(
    () => {
      const url = new URL(arg);
      url.search = '';
      return url.toString();
    },
    () => arg
  );
  return unwrapOr(redacted, arg);
}

function redactedCommand(args: string[]): string {
  return ['ffmpeg', ...args.map(redactedArg)].join(' ');
}

/**
 * Runs ffmpeg under a traced span with a hard timeout, escalating SIGTERM to
 * SIGKILL, and rejects with the classified error built from the stderr tail.
 */
export function runFfmpeg(options: FfmpegRunOptions): Promise<void> {
  const { ffmpegPath, stage, args, timeoutMs, onStdoutLine, limits, signal } = options;

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
      stdio: ['ignore', onStdoutLine ? 'pipe' : 'ignore', 'pipe'],
    });

    const stderrLines: string[] = [];
    let stopped: 'timeout' | 'aborted' | undefined;

    const stop = (reason: 'timeout' | 'aborted'): void => {
      stopped ??= reason;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, limits.killGraceMs);
    };
    const abort = () => stop('aborted');
    const timer = setTimeout(() => stop('timeout'), timeoutMs);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });

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
