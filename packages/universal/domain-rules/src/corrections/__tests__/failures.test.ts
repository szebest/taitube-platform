import { isInputFailure } from '@kit/errors';
import { ErrorCodes } from '@vp/errors';
import { correctionLimit, correctionNotFound, invalidCorrection } from '../failures';

describe('@vp/domain-rules: correction failures', () => {
  it('names the missing correction', () => {
    expect(correctionNotFound('c1')).toMatchObject({
      code: ErrorCodes.CORRECTION_NOT_FOUND,
      correctionId: 'c1',
    });
  });

  it('names the limit', () => {
    expect(correctionLimit('v1')).toMatchObject({
      code: ErrorCodes.CORRECTION_LIMIT,
      videoId: 'v1',
      limit: 10,
    });
  });

  it.each(['range', 'text'] as const)('names the %s field and is wire-safe', (field) => {
    const failure = invalidCorrection(field, 'no');

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field,
      maxTextLength: 200,
    });
    expect(isInputFailure(failure)).toBe(true);
  });
});
