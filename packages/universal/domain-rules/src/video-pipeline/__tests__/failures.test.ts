import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  generationInProgress,
  invalidVideoEdit,
  noEditToRevert,
  replacementNotUploaded,
} from '../failures';

describe('@vp/domain-rules: video pipeline failures', () => {
  it.each([
    {
      failure: generationInProgress('v1'),
      expected: { code: ErrorCodes.GENERATION_IN_PROGRESS, videoId: 'v1' },
    },
    {
      failure: replacementNotUploaded('v1', 3),
      expected: { code: ErrorCodes.REPLACEMENT_NOT_UPLOADED, videoId: 'v1', generation: 3 },
    },
    {
      failure: noEditToRevert('v1'),
      expected: { code: ErrorCodes.NO_EDIT_TO_REVERT, videoId: 'v1' },
    },
  ])('names $expected.code', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
  });

  it('reports an invalid edit as an input failure with its limits', () => {
    const failure = invalidVideoEdit('blurs', 'too many');

    expect(isInputFailure(failure)).toBe(true);
    expect(failure).toMatchObject({ field: 'blurs', maxBlurs: 20, minTrimMs: 1_000 });
  });
});
