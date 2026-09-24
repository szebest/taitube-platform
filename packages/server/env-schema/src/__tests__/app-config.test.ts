import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toAppConfig } from '../app-config';
import { AppEnvSchema } from '../app-env';

function exampleEnv(): Record<string, string> {
  const content = readFileSync(resolve(__dirname, '../../../../../.env.example'), 'utf8');
  const lines = content.split('\n').filter((line) => /^[A-Z_]+=/.test(line));
  return Object.fromEntries(
    lines.map((line) => {
      const [key, ...rest] = line.split('=');
      return [
        key as string,
        rest
          .join('=')
          .replace(/\s+#.*$/, '')
          .trim(),
      ];
    })
  );
}

describe('packages/env-schema: toAppConfig', () => {
  it('shapes the unmodified .env.example for its consumers', () => {
    const config = toAppConfig(AppEnvSchema.parse(exampleEnv()));

    expect(config).toMatchObject({
      kind: 'external',
      cdn: 'http://localhost:9000/public',
      buckets: { raw: 'raw', public: 'public' },
      limits: { maxInflightPerUser: 3, uploadRateLimitMax: 30, presignTtlSeconds: 900 },
      pagination: { defaultLimit: 20, maxLimit: 100 },
      sse: { heartbeatMs: 15000, maxPerUser: 20, maxPerPod: 5000 },
      auth: { type: 'dev', adminToken: 'change-me-32-bytes-random' },
      worker: { stage: 'probe', heartbeatPath: '/tmp/vp/heartbeat', tmpDir: '/tmp/vp' },
    });
  });

  it('builds from the minimum viable environment', () => {
    const config = toAppConfig(AppEnvSchema.parse({ DATABASE_URL: 'postgres://db:5432/vp' }));

    expect(config.postgres.url).toBe('postgres://db:5432/vp');
    expect(config.auth).toMatchObject({ type: 'dev', adminToken: undefined });
    expect(config.s3.accessKeyId).toBeUndefined();
  });

  it.each([
    { family: undefined, kind: 'external' },
    { family: 'external', kind: 'external' },
    { family: 'in-memory', kind: 'in-memory' },
  ])('takes the $kind family from ADAPTER_FAMILY=$family, not NODE_ENV', ({ family, kind }) => {
    const env = { DATABASE_URL: 'postgres://db/vp', NODE_ENV: 'test', ADAPTER_FAMILY: family };

    expect(toAppConfig(AppEnvSchema.parse(env)).kind).toBe(kind);
  });

  it('resolves jwks mode with the issuer, audience and algorithms it verifies against', () => {
    const config = toAppConfig(
      AppEnvSchema.parse({
        DATABASE_URL: 'postgres://db/vp',
        AUTH_MODE: 'jwks',
        AUTH_JWKS_URL: 'https://idp.example/.well-known/jwks.json',
        AUTH_ISSUER: 'https://idp.example/',
        AUTH_AUDIENCE: 'taitube',
        AUTH_ALGORITHMS: 'RS256, ES256',
      })
    );

    expect(config.auth).toMatchObject({
      type: 'jwks',
      jwksUrl: 'https://idp.example/.well-known/jwks.json',
      issuer: 'https://idp.example/',
      audience: 'taitube',
      algorithms: ['RS256', 'ES256'],
    });
  });

  it('resolves dev mode with the admin token acting as the dev user', () => {
    const config = toAppConfig(
      AppEnvSchema.parse({ DATABASE_URL: 'postgres://db/vp', ADMIN_TOKEN: 'operator' })
    );

    expect(config.auth).toEqual({
      type: 'dev',
      issuer: 'vp-dev',
      audience: 'vp-api',
      adminToken: 'operator',
      adminUserId: '00000000-0000-7000-8000-000000000001',
    });
  });

  it('migrates over DATABASE_URL when no separate migrations URL is set', () => {
    const config = toAppConfig(AppEnvSchema.parse({ DATABASE_URL: 'postgres://db/vp' }));

    expect(config.postgres.migrationsUrl).toBe('postgres://db/vp');
  });

  it('strips the CDN base once, so no consumer has to', () => {
    const config = toAppConfig(
      AppEnvSchema.parse({
        DATABASE_URL: 'postgres://db/vp',
        CDN_BASE_URL: 'https://cdn.example//',
      })
    );

    expect(config.cdn).toBe('https://cdn.example');
  });

  it('reads the buckets from the declared S3_BUCKET_* keys', () => {
    const config = toAppConfig(
      AppEnvSchema.parse({
        DATABASE_URL: 'postgres://db/vp',
        S3_BUCKET_RAW: 'vp-raw',
        S3_BUCKET_PUBLIC: 'vp-public',
      })
    );

    expect(config.buckets).toEqual({ raw: 'vp-raw', public: 'vp-public' });
  });
});
