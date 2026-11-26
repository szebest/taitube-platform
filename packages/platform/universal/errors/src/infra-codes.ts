/**
 * The codes of the infrastructure a port fronts. An app spreads them into the set it passes to
 * `defineErrorCodes`, so the string is written here and nowhere else.
 */
export const InfraErrorCodes = {
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  CACHE_UNAVAILABLE: 'CACHE_UNAVAILABLE',
  QUEUE_UNAVAILABLE: 'QUEUE_UNAVAILABLE',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
} as const;
