import { CommonErrorCodes } from '../common-codes';
import { defineErrorCodes, isRegisteredCode } from '../registry';

describe('@kit/errors: the common codes', () => {
  it('name themselves, as a code set requires', () => {
    expect(Object.entries(CommonErrorCodes).every(([key, code]) => key === code)).toBe(true);
  });

  it('extend an app set that spreads them in', () => {
    const codes = defineErrorCodes({
      codes: { ...CommonErrorCodes, GONE: 'GONE' },
      retryClass: { VALIDATION_FAILED: 'permanent', INTERNAL: 'transient', GONE: 'permanent' },
      internal: CommonErrorCodes.INTERNAL,
    });

    expect(Object.values(CommonErrorCodes).every((code) => isRegisteredCode(codes, code))).toBe(
      true
    );
  });
});
