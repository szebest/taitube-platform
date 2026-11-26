import { InfraErrorCodes } from './infra-codes';
import { type Unavailable, unavailable } from './unavailable';

export type DatabaseUnavailable = Unavailable<typeof InfraErrorCodes.DATABASE_UNAVAILABLE>;
export type CacheUnavailable = Unavailable<typeof InfraErrorCodes.CACHE_UNAVAILABLE>;
export type QueueUnavailable = Unavailable<typeof InfraErrorCodes.QUEUE_UNAVAILABLE>;
export type StorageUnavailable = Unavailable<typeof InfraErrorCodes.STORAGE_UNAVAILABLE>;

export type InfraFailure =
  | DatabaseUnavailable
  | CacheUnavailable
  | QueueUnavailable
  | StorageUnavailable;

export const databaseUnavailable = unavailable(
  InfraErrorCodes.DATABASE_UNAVAILABLE,
  'Database unavailable'
);
export const cacheUnavailable = unavailable(InfraErrorCodes.CACHE_UNAVAILABLE, 'Cache unavailable');
export const queueUnavailable = unavailable(InfraErrorCodes.QUEUE_UNAVAILABLE, 'Queue unavailable');
export const storageUnavailable = unavailable(
  InfraErrorCodes.STORAGE_UNAVAILABLE,
  'Storage unavailable'
);
