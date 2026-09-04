import { describe, expect, it } from 'vitest';
import { ErrorCodes, PermanentError, TransientError } from '../index.js';

describe('@vp/errors smoke test', () => {
  it('instantiates PermanentError with correct properties', () => {
    const err = new PermanentError(ErrorCodes.UPLOAD_TOO_LARGE, 'File exceeds 4 GB limit');
    expect(err.code).toBe('UPLOAD_TOO_LARGE');
    expect(err.message).toBe('File exceeds 4 GB limit');
    expect(err.isRetryable).toBe(false);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PermanentError);
  });

  it('instantiates TransientError with correct properties', () => {
    const err = new TransientError(ErrorCodes.STORAGE_UNAVAILABLE, 'S3 connection timed out');
    expect(err.code).toBe('STORAGE_UNAVAILABLE');
    expect(err.message).toBe('S3 connection timed out');
    expect(err.isRetryable).toBe(true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TransientError);
  });
});
