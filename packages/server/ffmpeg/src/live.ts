import { type Fmp4Fragment, Fmp4FragmentSplitter } from './fmp4-fragments';
import { buildLiveArgs, type LiveArgsOptions } from './live-args';
import { type FfmpegProcessLimits, runFfmpeg } from './run-ffmpeg';

export interface LiveOptions extends LiveArgsOptions {
  ffmpegPath: string;
  limits: FfmpegProcessLimits;
  /** The longest broadcast a run is let go on for. */
  timeoutMs: number;
  onFragment: (fragment: Fmp4Fragment) => void;
  signal?: AbortSignal;
}

/**
 * Packages one broadcast for as long as the ingest sends: resolves when the publisher stops and
 * ffmpeg reaches the end of its input, rejects like any other run otherwise. A stream the splitter
 * or `onFragment` rejects stops ffmpeg and rejects with that error, never from inside the pipe.
 */
export async function runFfmpegLive(options: LiveOptions): Promise<void> {
  const splitter = new Fmp4FragmentSplitter();
  const broken = new AbortController();
  let cause: unknown;

  const run = runFfmpeg({
    ffmpegPath: options.ffmpegPath,
    limits: options.limits,
    signal: options.signal ? AbortSignal.any([options.signal, broken.signal]) : broken.signal,
    stage: 'live',
    args: buildLiveArgs(options),
    timeoutMs: options.timeoutMs,
    attributes: { 'ffmpeg.rendition': options.rendition.name },
    stdout: {
      type: 'bytes',
      onChunk: (chunk) => {
        if (broken.signal.aborted) return;
        try {
          for (const fragment of splitter.push(chunk)) options.onFragment(fragment);
        } catch (error) {
          cause = error;
          broken.abort();
        }
      },
    },
  });

  await run.catch((error: unknown) => {
    throw cause ?? error;
  });
}
