import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  invalidVideoPassword,
  videoPasswordInvalid,
  videoPasswordRequired,
  videoPasswordsOff,
} from '../failures';

describe('@vp/domain-rules: video access failures', () => {
  it.each([
    {
      failure: videoPasswordRequired('v1'),
      expected: { code: ErrorCodes.VIDEO_PASSWORD_REQUIRED, videoId: 'v1' },
    },
    {
      failure: videoPasswordInvalid('v1'),
      expected: { code: ErrorCodes.VIDEO_PASSWORD_INVALID, videoId: 'v1' },
    },
    { failure: videoPasswordsOff(), expected: { code: ErrorCodes.VIDEO_PASSWORDS_OFF } },
  ])('names $expected.code', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
  });

  it.each(['password', 'visibility'] as const)('names the %s field and is wire-safe', (field) => {
    const failure = invalidVideoPassword(field, 'no');

    expect(failure).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field,
      minLength: 4,
      maxLength: 128,
    });
    expect(isInputFailure(failure)).toBe(true);
  });
});
