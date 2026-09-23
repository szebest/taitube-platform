/** The smallest environment a production boot accepts: rotated secrets and a jwks issuer. */
export const PRODUCTION_ENV: Readonly<Record<string, string>> = {
  NODE_ENV: 'production',
  AUTH_MODE: 'jwks',
  AUTH_JWKS_URL: 'https://idp.vp.local/.well-known/jwks.json',
  AUTH_ISSUER: 'https://idp.vp.local/',
  AUTH_AUDIENCE: 'taitube',
  CORS_ORIGINS: 'https://taitube.vp.local',
  DATABASE_URL: 'postgres://app:rotated@db.internal:5432/vp',
  S3_ACCESS_KEY_ID: 'rotated-access-key',
  S3_SECRET_ACCESS_KEY: 'rotated-secret-key',
  REDIS_PASSWORD: 'rotated-redis-password',
};
