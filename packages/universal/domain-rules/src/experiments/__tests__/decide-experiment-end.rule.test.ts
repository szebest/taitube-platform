import { err, ok } from '@kit/result';
import type { Experiment, ExperimentStatus } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { decideExperimentApply, decideExperimentStop } from '../decide-experiment-end.rule';

function anExperiment(status: ExperimentStatus = 'running'): Experiment {
  return {
    id: 'exp-1',
    videoId: 'video-1',
    kind: 'title',
    variants: [
      { id: 'a', title: 'First', thumbnail: null },
      { id: 'b', title: 'Second', thumbnail: null },
    ],
    status,
    startedAt: new Date('2026-11-01T00:00:00.000Z'),
    endedAt: null,
    winnerVariantId: null,
  };
}

describe('@vp/domain-rules: ending a test', () => {
  it('stops a running test', () => {
    const experiment = anExperiment();

    expect(decideExperimentStop(experiment)).toEqual(ok(experiment));
  });

  it('applies the variant the creator picked', () => {
    expect(decideExperimentApply(anExperiment(), 'b')).toEqual(
      ok({ id: 'b', title: 'Second', thumbnail: null })
    );
  });

  it('refuses a variant the test does not have', () => {
    expect(decideExperimentApply(anExperiment(), 'c')).toMatchObject(
      err({ code: ErrorCodes.VALIDATION_FAILED, field: 'variantId' })
    );
  });

  it.each(['finished', 'stopped'] as const)('leaves a %s test as it ended', (status) => {
    const ended = anExperiment(status);

    expect(decideExperimentStop(ended)).toMatchObject(
      err({ code: ErrorCodes.EXPERIMENT_NOT_RUNNING })
    );
    expect(decideExperimentApply(ended, 'a')).toMatchObject(
      err({ code: ErrorCodes.EXPERIMENT_NOT_RUNNING })
    );
  });
});
