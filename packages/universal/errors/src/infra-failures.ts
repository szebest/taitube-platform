import { ErrorCodes } from './error-codes';
import type { Failure } from './failure';

type UnavailableCode =
  | typeof ErrorCodes.DATABASE_UNAVAILABLE
  | typeof ErrorCodes.CACHE_UNAVAILABLE
  | typeof ErrorCodes.QUEUE_UNAVAILABLE
  | typeof ErrorCodes.STORAGE_UNAVAILABLE;

type Unavailable<C extends UnavailableCode> = Failure<C, { operation: string; cause?: unknown }>;

export type DatabaseUnavailable = Unavailable<typeof ErrorCodes.DATABASE_UNAVAILABLE>;
export type CacheUnavailable = Unavailable<typeof ErrorCodes.CACHE_UNAVAILABLE>;
export type QueueUnavailable = Unavailable<typeof ErrorCodes.QUEUE_UNAVAILABLE>;
export type StorageUnavailable = Unavailable<typeof ErrorCodes.STORAGE_UNAVAILABLE>;

export type InfraFailure =
  | DatabaseUnavailable
  | CacheUnavailable
  | QueueUnavailable
  | StorageUnavailable;

function unavailable<C extends UnavailableCode>(code: C, subject: string) {
  return (operation: string, cause?: unknown): Unavailable<C> => ({
    code,
    message: `${subject} unavailable`,
    operation,
    ...(cause === undefined ? {} : { cause }),
  });
}

export const databaseUnavailable = unavailable(ErrorCodes.DATABASE_UNAVAILABLE, 'Database');
export const cacheUnavailable = unavailable(ErrorCodes.CACHE_UNAVAILABLE, 'Cache');
export const queueUnavailable = unavailable(ErrorCodes.QUEUE_UNAVAILABLE, 'Queue');
export const storageUnavailable = unavailable(ErrorCodes.STORAGE_UNAVAILABLE, 'Storage');
