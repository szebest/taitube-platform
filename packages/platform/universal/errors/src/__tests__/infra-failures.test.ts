import { InfraErrorCodes } from '../infra-codes';
import {
  cacheUnavailable,
  databaseUnavailable,
  queueUnavailable,
  storageUnavailable,
} from '../infra-failures';

describe('@kit/errors: infra failures', () => {
  it.each([
    {
      build: databaseUnavailable,
      code: InfraErrorCodes.DATABASE_UNAVAILABLE,
      message: 'Database unavailable',
    },
    {
      build: cacheUnavailable,
      code: InfraErrorCodes.CACHE_UNAVAILABLE,
      message: 'Cache unavailable',
    },
    {
      build: queueUnavailable,
      code: InfraErrorCodes.QUEUE_UNAVAILABLE,
      message: 'Queue unavailable',
    },
    {
      build: storageUnavailable,
      code: InfraErrorCodes.STORAGE_UNAVAILABLE,
      message: 'Storage unavailable',
    },
  ])('builds $code naming the operation that failed', ({ build, code, message }) => {
    expect(build('findById')).toEqual({ code, message, operation: 'findById' });
  });
});
