import { spawn } from 'node:child_process';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { tryCatch } from '@vp/result';
import { type ProbeMetadata, type RawFfprobeOutput, validateAndParseProbe } from './probe-metadata';

export interface FfprobeOptions {
  ffprobePath: string;
  maxDurationSec: number;
}

/**
 * Runs ffprobe on a file path or URL and returns validated ProbeMetadata (SDD §8.1).
 */
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
