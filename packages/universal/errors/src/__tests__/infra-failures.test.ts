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

  it.each([databaseUnavailable, cacheUnavailable, queueUnavailable, storageUnavailable])(
    'maps a rejection of one operation to the same failure through during()',
    (build) => {
      const cause = new Error('ECONNREFUSED');

      expect(build.during('findById')(cause)).toEqual(build('findById', cause));
    }
  );

  it('carries the cause when one is given', () => {
    const cause = new Error('ECONNREFUSED');

    expect(databaseUnavailable('insert', cause).cause).toBe(cause);
  });

  it('omits the cause key entirely when none is given', () => {
    expect(databaseUnavailable('insert')).not.toHaveProperty('cause');
  });

  it('names no field, so an infra payload never reaches Problem.errors', () => {
    expect(databaseUnavailable('insert')).not.toHaveProperty('field');
  });

  it('keeps the operation out of the message, which is the part a client is shown', () => {
    expect(databaseUnavailable('findWithDetails').message).not.toContain('findWithDetails');
  });
});
