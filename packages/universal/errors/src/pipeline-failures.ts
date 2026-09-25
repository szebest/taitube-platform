import type { Failure } from './failure';
import { type PipelineErrorCode, PipelineErrorCodes } from './pipeline-error-codes';
import { PipelineError } from './pipeline-error';

/**
 * What a pipeline stage rejected the media for. The union is `PipelineErrorCode` rather than a
 * single code because one stage genuinely has several answers - a container it cannot read and a
 * codec it will not accept are different verdicts - and `RETRY_CLASS` already classifies each.
 */
export type MediaFailure = Failure<PipelineErrorCode, { stage: string }>;

export function mediaFailure(
  stage: string,
  code: PipelineErrorCode,
  message: string
): MediaFailure {
  return { code, message, stage };
}

function isPipelineErrorCode(code: unknown): code is PipelineErrorCode {
  return typeof code === 'string' && code in PipelineErrorCodes;
}

/**
 * The `@vp/ffmpeg` boundary. Spawning a process is out of ADR-24's scope, so `@vp/ffmpeg` still
 * throws; this is the one place that stops, and it keeps the code the process reported instead of
 * inventing one.
 */
export function mediaFailureFrom(
  stage: string,
  cause: unknown,
  fallback: PipelineErrorCode = PipelineErrorCodes.FFMPEG_FAILED
): MediaFailure {
  if (cause instanceof PipelineError && isPipelineErrorCode(cause.code)) {
    return mediaFailure(stage, cause.code, cause.message);
  }
  return mediaFailure(stage, fallback, (cause as Error)?.message ?? String(cause));
}
