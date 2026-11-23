import * as path from 'node:path';
import { type ApplyEditsArgsOptions, buildApplyEditsArgs } from './apply-edits-args';
import { runFfmpeg } from './run-ffmpeg';
import {
  progressLineHandler,
  type TranscodeExecutionResult,
  type TranscodeOptions,
} from './transcode';

export type ApplyEditsOptions = ApplyEditsArgsOptions &
  Omit<TranscodeOptions, keyof ApplyEditsArgsOptions>;

/** Renders one rendition of a new generation through the edit list, under the transcode's timeout. */
export async function runFfmpegApplyEdits(
  options: ApplyEditsOptions
): Promise<TranscodeExecutionResult> {
  const { durationMs, outputDir } = options;
  await runFfmpeg({
    ffmpegPath: options.ffmpegPath,
    limits: options.limits,
    signal: options.signal,
    stage: 'apply-edits',
    args: buildApplyEditsArgs(options),
    timeoutMs: Math.max(options.timeoutFactor * durationMs, options.minTimeoutMs),
    attributes: { 'ffmpeg.rendition': options.rendition.name, rendition: options.rendition.name },
    stdout: { type: 'lines', onLine: progressLineHandler(durationMs, options.onProgress) },
  });
  return {
    outputDir,
    playlistPath: path.join(outputDir, 'index.m3u8'),
    segmentCount: 0,
    durationMs,
  };
}
