import { ErrorCodes, isInputFailure } from '@vp/errors';
import { preferencesConflict } from '../failures';

describe('@vp/domain-rules: preferences failures', () => {
  it('reports a conflict with what is stored, kept off the wire unless a presenter puts it there', () => {
    const failure = preferencesConflict('user-1', null);

    expect(failure).toMatchObject({
      code: ErrorCodes.VERSION_CONFLICT,
      userId: 'user-1',
      current: null,
    });
    expect(isInputFailure(failure)).toBe(false);
  });
});
