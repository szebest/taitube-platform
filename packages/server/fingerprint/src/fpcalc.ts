import { ErrorCodes, type Failure, PermanentError } from '@vp/errors';
import { type FfmpegProcessLimits, runFfmpeg } from '@vp/ffmpeg';
import { type Result, err, ok, tryCatch } from '@vp/result';
import { z } from 'zod';

const FpcalcOutput = z.object({
  duration: z.number().nonnegative(),
  fingerprint: z.array(z.number().int().nonnegative()),
});

export interface Chromaprint {
  durationSeconds: number;
  /** The raw 32-bit sub-fingerprints as signed integers, one per Chromaprint item, in order. */
  terms: number[];
}

/** Under about 2.7 s of audio fpcalc exits 2 with `Empty fingerprint`, and ffmpeg's retry policy would retry that. */
const MIN_FINGERPRINT_SECONDS = 3;

type FpcalcOutputInvalid = Failure<typeof ErrorCodes.CORRUPT_CONTAINER>;

/**
 * `-length` is the whole duration, rounded up: fpcalc stops at 120 seconds by default, and a
 * fingerprint of the first two minutes cannot match a trimmed copy.
 */
function buildFpcalcArgs(options: { sourcePath: string; durationSeconds: number }): string[] {
  return [
    '-raw',
    '-json',
    '-length',
    String(Math.ceil(options.durationSeconds)),
    options.sourcePath,
  ];
}

function parseFpcalcOutput(output: string): Result<Chromaprint, FpcalcOutputInvalid> {
  const json = tryCatch(
    (): unknown => JSON.parse(output),
    (): FpcalcOutputInvalid => ({
      code: ErrorCodes.CORRUPT_CONTAINER,
      message: 'fpcalc did not print JSON',
    })
  );
  if (!json.ok) return json;
  const parsed = FpcalcOutput.safeParse(json.value);
  if (!parsed.success) {
    return err({
      code: ErrorCodes.CORRUPT_CONTAINER,
      message: `fpcalc printed an unexpected shape: ${parsed.error.message}`,
    });
  }
  return ok({
    durationSeconds: parsed.data.duration,
    terms: parsed.data.fingerprint.map((term) => term | 0),
  });
}

export interface RunFpcalcOptions {
  fpcalcPath: string;
  sourcePath: string;
  durationSeconds: number;
  timeoutMs: number;
  limits: FfmpegProcessLimits;
  signal?: AbortSignal;
}

/**
 * Runs fpcalc as a subprocess under the same span, timeout and kill grace as ffmpeg. A clip too short
 * to fingerprint has nothing to match, like one without audio, so it gets an empty sequence.
 */
export async function runFpcalc(options: RunFpcalcOptions): Promise<Chromaprint> {
  if (options.durationSeconds < MIN_FINGERPRINT_SECONDS) return { durationSeconds: 0, terms: [] };
  const lines: string[] = [];
  await runFfmpeg({
    ffmpegPath: options.fpcalcPath,
    limits: options.limits,
    signal: options.signal,
    stage: 'screen-audio',
    args: buildFpcalcArgs(options),
    timeoutMs: options.timeoutMs,
    attributes: { 'ffmpeg.tool': 'fpcalc' },
    stdout: { type: 'lines', onLine: (line) => lines.push(line) },
  });
  const parsed = parseFpcalcOutput(lines.join(''));
  if (!parsed.ok) throw new PermanentError(parsed.error.code, parsed.error.message);
  return parsed.value;
}
