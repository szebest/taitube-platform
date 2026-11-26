import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import {
  experimentLimit,
  experimentNotFound,
  experimentNotRunning,
  invalidExperiment,
} from '../failures';

describe('@vp/domain-rules: experiment failures', () => {
  it.each([
    {
      failure: experimentNotFound('e1'),
      expected: { code: ErrorCodes.EXPERIMENT_NOT_FOUND, experimentId: 'e1' },
    },
    {
      failure: experimentNotRunning('e1'),
      expected: { code: ErrorCodes.EXPERIMENT_NOT_RUNNING, experimentId: 'e1' },
    },
    {
      failure: experimentLimit('v1', 'video'),
      expected: { code: ErrorCodes.EXPERIMENT_LIMIT, videoId: 'v1', scope: 'video', limit: 1 },
    },
    {
      failure: experimentLimit('v1', 'channel'),
      expected: { code: ErrorCodes.EXPERIMENT_LIMIT, videoId: 'v1', scope: 'channel', limit: 5 },
    },
  ])('names $expected.code', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
  });

  it('names the field and is wire-safe', () => {
    const failure = invalidExperiment('variants', 'no');

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'variants',
      minVariants: 2,
      maxVariants: 3,
    });
    expect(isInputFailure(failure)).toBe(true);
  });
});
