import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidCaptionFile, invalidCaptionLanguage } from '../failures';

describe('@vp/validation: caption failures', () => {
  it('names the line of a malformed file in the message the creator reads', () => {
    expect(invalidCaptionFile(4, 'Bad cue timing')).toEqual({
      code: ErrorCodes.VALIDATION_FAILED,
      message: 'Line 4: Bad cue timing',
      field: 'body',
      line: 4,
    });
  });

  it.each([
    { name: 'a malformed file', failure: invalidCaptionFile(1, 'Missing header') },
    { name: 'a bad language', failure: invalidCaptionLanguage('lang', 'x!') },
  ])('puts $name on the wire', ({ failure }) => {
    expect(isInputFailure(failure)).toBe(true);
  });
});
