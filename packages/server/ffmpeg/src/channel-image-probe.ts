import { spawn } from 'node:child_process';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { tryCatch } from '@vp/result';
import {
  type ChannelImageProbe,
  type RawImageProbe,
  parseChannelImageProbe,
} from './parse-channel-image-probe';

export type { ChannelImageProbe };

export interface ChannelImageProbeOptions {
  ffprobePath: string;
  timeoutMs: number;
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
