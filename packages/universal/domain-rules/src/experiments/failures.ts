import {
  MAX_EXPERIMENT_VARIANTS,
  MAX_RUNNING_EXPERIMENTS_PER_CHANNEL,
  MIN_EXPERIMENT_VARIANTS,
} from '@vp/domain';
import { ErrorCodes, type Failure } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';

export type ExperimentNotFound = Failure<
  typeof ErrorCodes.EXPERIMENT_NOT_FOUND,
  { experimentId: string }
>;
/** `video`: one is already running on it; `channel`: the channel runs the most it may. */
export type ExperimentLimit = Failure<
  typeof ErrorCodes.EXPERIMENT_LIMIT,
  { videoId: string; scope: 'video' | 'channel'; limit: number }
>;
export type ExperimentNotRunning = Failure<
  typeof ErrorCodes.EXPERIMENT_NOT_RUNNING,
  { experimentId: string }
>;
export type InvalidExperiment = InvalidField<{
  readonly minVariants: number;
  readonly maxVariants: number;
}>;

export function experimentNotFound(experimentId: string): ExperimentNotFound {
  return { code: ErrorCodes.EXPERIMENT_NOT_FOUND, message: 'Test not found', experimentId };
}

export function experimentLimit(videoId: string, scope: 'video' | 'channel'): ExperimentLimit {
  return scope === 'video'
    ? {
        code: ErrorCodes.EXPERIMENT_LIMIT,
        message: 'A test is already running on this video',
        videoId,
        scope,
        limit: 1,
      }
    : {
        code: ErrorCodes.EXPERIMENT_LIMIT,
        message: `A channel runs at most ${MAX_RUNNING_EXPERIMENTS_PER_CHANNEL} tests at once`,
        videoId,
        scope,
        limit: MAX_RUNNING_EXPERIMENTS_PER_CHANNEL,
      };
}

export function experimentNotRunning(experimentId: string): ExperimentNotRunning {
  return {
    code: ErrorCodes.EXPERIMENT_NOT_RUNNING,
    message: 'This test has already ended',
    experimentId,
  };
}

export function invalidExperiment(
  field: 'variants' | 'title' | 'thumbnail' | 'kind' | 'variantId',
  reason: string
): InvalidExperiment {
  return invalidField(field, reason, {
    minVariants: MIN_EXPERIMENT_VARIANTS,
    maxVariants: MAX_EXPERIMENT_VARIANTS,
  });
}
