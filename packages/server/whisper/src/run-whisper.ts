import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ErrorCodes, type MediaFailure, mediaFailure } from '@vp/errors';
import { err, fromPromise, isErr, isOk, type Result } from '@vp/result';
import { classifyWhisperFailure } from './classify-whisper-failure';
import { buildWhisperArgs, type WhisperArgsOptions } from './whisper-args';
import { parseWhisperOutput, type WhisperTranscript } from './whisper-output';

export interface WhisperRunOptions extends WhisperArgsOptions {
  whisperPath: string;
  timeoutMs: number;
  killGraceMs: number;
  stderrTailLines: number;
  /** Runs whisper under `nice -n 19`, so a captions pod never outbids anything else for CPU. */
  niceness: number | undefined;
  signal?: AbortSignal;
}

interface Exit {
  code: number | null;
  signal: string | null;
  stopped: 'timeout' | 'aborted' | undefined;
  stderr: string;
}

async function modelProblem(paths: string[]): Promise<MediaFailure | undefined> {
  for (const path of paths) {
    const found = await fromPromise(
      () => stat(path),
      () => undefined
    );
    if (isErr(found) || found.value.size === 0) {
      return mediaFailure(
        'captions',
        ErrorCodes.WHISPER_MODEL_INVALID,
        `model file ${path} is missing or empty`
      );
    }
  }
  return undefined;
}

function spawnWhisper(options: WhisperRunOptions): Promise<Exit> {
  const args = buildWhisperArgs(options);
  const [command, argv] =
    options.niceness === undefined
      ? [options.whisperPath, args]
      : ['nice', ['-n', String(options.niceness), options.whisperPath, ...args]];

  return new Promise((resolve) => {
    const proc = spawn(command, argv, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderrLines: string[] = [];
    let stopped: Exit['stopped'];
    let exited = false;

    const stop = (reason: 'timeout' | 'aborted'): void => {
      stopped ??= reason;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!exited) proc.kill('SIGKILL');
      }, options.killGraceMs);
    };
    const abort = () => stop('aborted');
    const timer = setTimeout(() => stop('timeout'), options.timeoutMs);
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });

    proc.stderr?.setEncoding('utf-8');
    proc.stderr?.on('data', (chunk: string) => {
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        stderrLines.push(line.trim());
        if (stderrLines.length > options.stderrTailLines) stderrLines.shift();
      }
    });

    const settle = (code: number | null, signal: string | null) => {
      exited = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      resolve({ code, signal, stopped, stderr: stderrLines.join('\n') });
    };
    proc.on('error', (cause) => {
      stderrLines.push(cause.message);
      settle(null, null);
    });
    proc.on('close', settle);
  });
}

function failureOf(exit: Exit, timeoutMs: number): MediaFailure | undefined {
  if (exit.stopped === 'timeout') {
    return mediaFailure('captions', ErrorCodes.WHISPER_TIMEOUT, `whisper exceeded ${timeoutMs}ms`);
  }
  if (exit.stopped === 'aborted') {
    return mediaFailure('captions', ErrorCodes.WHISPER_KILLED, 'whisper was aborted');
  }
  if (exit.code !== 0) return classifyWhisperFailure(exit.code, exit.signal, exit.stderr);
  return undefined;
}

async function transcriptOf(
  exit: Exit,
  options: WhisperRunOptions
): Promise<Result<WhisperTranscript, MediaFailure>> {
  const failed = failureOf(exit, options.timeoutMs);
  if (failed) return err(failed);

  const output = await fromPromise(
    () => readFile(`${options.outputBase}.json`, 'utf-8'),
    () => classifyWhisperFailure(exit.code, exit.signal, exit.stderr)
  );
  return isErr(output) ? output : parseWhisperOutput(output.value);
}

/**
 * Transcribes one audio file. whisper.cpp can exit 0 without writing its output (an unreadable
 * input), so a missing JSON file is classified from stderr like a failed exit.
 */
export async function runWhisper(
  options: WhisperRunOptions
): Promise<Result<WhisperTranscript, MediaFailure>> {
  const missing = await modelProblem([options.modelPath, options.vadModelPath]);
  if (missing) return err(missing);

  const span = trace.getTracer('video-pipeline').startSpan('whisper', {
    attributes: {
      'whisper.threads': options.threads,
      'whisper.language': options.language ?? 'auto',
    },
  });
  const exit = await spawnWhisper(options);
  const transcript = await transcriptOf(exit, options);

  span.setAttribute('whisper.exit_code', exit.code ?? -1);
  span.setStatus(
    isOk(transcript)
      ? { code: SpanStatusCode.OK }
      : { code: SpanStatusCode.ERROR, message: transcript.error.message }
  );
  span.end();
  return transcript;
}
