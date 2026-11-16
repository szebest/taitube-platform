import { createRegistry, provide } from '@kit/di';
import { err, ok } from '@vp/result';
import { defineErrorCodes, ErrorCodeRegistry, isRegisteredCode, retryClass } from '../registry';
import { codes } from './fixtures';

describe('@vp/errors: the error code registry', () => {
  it('freezes what the app defined', () => {
    expect([Object.isFrozen(codes), Object.isFrozen(codes.retryClass)]).toEqual([true, true]);
  });

  it.each([
    { code: 'NOT_FOUND', registered: true },
    { code: 'SOMETHING_NEW', registered: false },
    { code: 'toString', registered: false },
    { code: 42, registered: false },
  ])('knows whether $code is registered', ({ code, registered }) => {
    expect(isRegisteredCode(codes, code)).toBe(registered);
  });

  it.each([
    { code: 'NOT_FOUND', expected: 'permanent' },
    { code: 'DOWN', expected: 'transient' },
    { code: 'SOMETHING_NEW', expected: 'transient' },
  ])('gives $code the retry class $expected', ({ code, expected }) => {
    expect(retryClass(codes, code)).toBe(expected);
  });

  it('resolves the set an app provided, and a swapped one in its place', () => {
    const other = defineErrorCodes({
      codes: { GONE: 'GONE' },
      retryClass: { GONE: 'permanent' },
      internal: 'GONE',
    });

    expect([
      createRegistry().provide(provide(ErrorCodeRegistry, codes)).get(ErrorCodeRegistry),
      createRegistry().provide(provide(ErrorCodeRegistry, other)).get(ErrorCodeRegistry),
    ]).toEqual([ok(codes), ok(other)]);
  });

  it('has no default: an unprovided registry is MissingProvider', () => {
    expect(createRegistry().get(ErrorCodeRegistry)).toEqual(
      err(expect.objectContaining({ code: 'MISSING_PROVIDER', token: 'ErrorCodeRegistry' }))
    );
  });
});
