/** What a production boot cannot start without, and what the cloud overlay's `ExternalSecret` supplies. */
export const SECRET_KEYS = [
  'DATABASE_URL',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'REDIS_PASSWORD',
] as const;
