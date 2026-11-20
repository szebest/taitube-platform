/**
 * The codes a platform package may emit without owning a domain of its own. An app spreads them into
 * the set it passes to `defineErrorCodes`, so the string is written here and nowhere else.
 */
export const CommonErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTERNAL: 'INTERNAL',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;
