import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '../result';

describe('@vp/testing: result unwrapping', () => {
  it('returns the value of a success', () => {
    expect(expectOk(ok(7))).toBe(7);
  });

  it('returns the error of a failure', () => {
    expect(expectErr(err({ code: 'NOPE' }))).toEqual({ code: 'NOPE' });
  });

  it('names the unexpected failure rather than throwing something opaque', () => {
    expect(() => expectOk(err({ code: 'DATABASE_UNAVAILABLE' }))).toThrow('DATABASE_UNAVAILABLE');
  });

  it('names the unexpected value when a failure was expected', () => {
    expect(() => expectErr(ok({ id: 'v1' }))).toThrow('v1');
  });
});
