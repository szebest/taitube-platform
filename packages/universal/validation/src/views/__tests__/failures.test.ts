import { ErrorCodes } from '@vp/errors';
import { viewTooShort } from '../failures';

describe('validation: view failures', () => {
  it('names the watch time it rejected and the time it needed', () => {
    expect(viewTooShort(2, 5)).toEqual({
      code: ErrorCodes.VALIDATION_FAILED,
      message: 'A view needs at least 5s of watch time',
      field: 'watchSeconds',
      watchSeconds: 2,
      requiredSeconds: 5,
    });
  });
});
