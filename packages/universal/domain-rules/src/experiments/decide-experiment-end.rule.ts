import { type Result, err, ok } from '@kit/result';
import type { Experiment, ExperimentVariant } from '@vp/domain';
import { EXPERIMENT } from './experiment.machine';
import {
  type ExperimentNotRunning,
  type InvalidExperiment,
  experimentNotRunning,
  invalidExperiment,
} from './failures';

/** Stopping ends a running test without a winner; an ended one stays as it ended. */
export function decideExperimentStop(
  experiment: Experiment
): Result<Experiment, ExperimentNotRunning> {
  return EXPERIMENT.next(experiment.status, 'stop')
    ? ok(experiment)
    : err(experimentNotRunning(experiment.id));
}

/** The creator's winner, which only a running test takes: nothing is ever applied for them. */
export function decideExperimentApply(
  experiment: Experiment,
  variantId: string
): Result<ExperimentVariant, ExperimentNotRunning | InvalidExperiment> {
  if (!EXPERIMENT.next(experiment.status, 'apply')) return err(experimentNotRunning(experiment.id));
  const winner = experiment.variants.find(({ id }) => id === variantId);
  return winner ? ok(winner) : err(invalidExperiment('variantId', 'Pick one of the test variants'));
}
