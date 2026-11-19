import { err, ok } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { decideVideoPassword } from '../decide-video-password.rule';

describe('@vp/domain-rules: decideVideoPassword', () => {
  it.each(['abcd', ' with spaces ', 'x'.repeat(128), 'żółć'])(
    'takes %j on an unlisted video as typed',
    (password) => {
      expect(decideVideoPassword(password, { visibility: 'unlisted' })).toEqual(ok(password));
    }
  );

  it.each(['abc', 'x'.repeat(129), ''])('refuses %j for its length', (password) => {
    expect(decideVideoPassword(password, { visibility: 'unlisted' })).toMatchObject(
      err({ code: ErrorCodes.VALIDATION_FAILED, field: 'password' })
    );
  });

  it.each(['public', 'private'] as const)('refuses a password on a %s video', (visibility) => {
    expect(decideVideoPassword('secret', { visibility })).toMatchObject(
      err({ code: ErrorCodes.VALIDATION_FAILED, field: 'visibility' })
    );
  });
});
