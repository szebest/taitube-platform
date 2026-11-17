import { ErrorCodes } from '../error-codes';
import {
  cacheUnavailable,
  databaseUnavailable,
  queueUnavailable,
  storageUnavailable,
} from '../infra-failures';

describe('@vp/errors: infra failure constructors', () => {
  it.each([
    { build: databaseUnavailable, code: ErrorCodes.DATABASE_UNAVAILABLE, subject: 'Database' },
    { build: cacheUnavailable, code: ErrorCodes.CACHE_UNAVAILABLE, subject: 'Cache' },
    { build: queueUnavailable, code: ErrorCodes.QUEUE_UNAVAILABLE, subject: 'Queue' },
    { build: storageUnavailable, code: ErrorCodes.STORAGE_UNAVAILABLE, subject: 'Storage' },
  ])('builds $code naming the operation that failed', ({ build, code, subject }) => {
    expect(build('findById')).toEqual({
      code,
      message: `${subject} unavailable`,
      operation: 'findById',
    });
  });
});
