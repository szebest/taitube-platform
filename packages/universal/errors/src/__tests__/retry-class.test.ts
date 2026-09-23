import { ErrorCodes } from '../error-codes';
import { RETRY_CLASS, retryClass } from '../retry-class';

describe('@vp/errors: RETRY_CLASS', () => {
  it('classifies every code in the taxonomy', () => {
    expect(Object.keys(RETRY_CLASS).sort()).toEqual(Object.keys(ErrorCodes).sort());
  });

  it('only ever says permanent or transient', () => {
    expect([...new Set(Object.values(RETRY_CLASS))].sort()).toEqual(['permanent', 'transient']);
  });

  it.each([
    { code: ErrorCodes.CORRUPT_CONTAINER, expected: 'permanent' },
    { code: ErrorCodes.UNSUPPORTED_CODEC, expected: 'permanent' },
    { code: ErrorCodes.DURATION_EXCEEDED, expected: 'permanent' },
    { code: ErrorCodes.SOURCE_MISSING, expected: 'permanent' },
    { code: ErrorCodes.STORAGE_UNAVAILABLE, expected: 'transient' },
    { code: ErrorCodes.FFMPEG_OOM, expected: 'transient' },
    { code: ErrorCodes.DISK_FULL, expected: 'transient' },
  ])('follows ADR-18 for $code', ({ code, expected }) => {
    expect(retryClass(code)).toBe(expected);
  });

  it('defaults an unknown code to transient', () => {
    expect(retryClass('SOMETHING_ELSE')).toBe('transient');
  });
});
