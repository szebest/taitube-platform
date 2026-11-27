import { describeErrorCodeSetContract } from '@kit/errors/contract';
import { errorCodeRegistry, isErrorCode } from '../error-code-registry';
import { ErrorCodes } from '../error-codes';
import { RETRY_CLASS } from '../retry-class';

describeErrorCodeSetContract(() => errorCodeRegistry);

describe('@vp/errors: the app registry', () => {
  it('registers every code with its retry class, INTERNAL for what carries none', () => {
    expect(errorCodeRegistry).toEqual({
      codes: ErrorCodes,
      retryClass: RETRY_CLASS,
      internal: ErrorCodes.INTERNAL,
    });
  });

  it.each([
    { code: ErrorCodes.VIDEO_NOT_FOUND, known: true },
    { code: 'SOMETHING_NEW', known: false },
  ])('isErrorCode knows $code: $known', ({ code, known }) => {
    expect(isErrorCode(code)).toBe(known);
  });
});
