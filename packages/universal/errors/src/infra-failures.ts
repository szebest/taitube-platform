import { ErrorCodes } from './error-codes';
import { type Unavailable, unavailable } from './unavailable';

export type DatabaseUnavailable = Unavailable<typeof ErrorCodes.DATABASE_UNAVAILABLE>;
export type CacheUnavailable = Unavailable<typeof ErrorCodes.CACHE_UNAVAILABLE>;
export type QueueUnavailable = Unavailable<typeof ErrorCodes.QUEUE_UNAVAILABLE>;
export type StorageUnavailable = Unavailable<typeof ErrorCodes.STORAGE_UNAVAILABLE>;

export type InfraFailure =
  | DatabaseUnavailable
  | CacheUnavailable
  | QueueUnavailable
  | StorageUnavailable;

export const databaseUnavailable = unavailable(
  ErrorCodes.DATABASE_UNAVAILABLE,
  'Database unavailable'
);
export const cacheUnavailable = unavailable(ErrorCodes.CACHE_UNAVAILABLE, 'Cache unavailable');
export const queueUnavailable = unavailable(ErrorCodes.QUEUE_UNAVAILABLE, 'Queue unavailable');
export const storageUnavailable = unavailable(
  ErrorCodes.STORAGE_UNAVAILABLE,
  'Storage unavailable'
);
