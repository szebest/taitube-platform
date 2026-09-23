import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inProcessAppConfig, toAppConfig } from '../app-config';
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
      auth: { adminToken: 'change-me-32-bytes-random' },
      worker: { stage: 'probe', heartbeatPath: '/tmp/vp/heartbeat', tmpDir: '/tmp/vp' },
    });
  });

  it('builds from the minimum viable environment', () => {
    const config = toAppConfig(AppEnvSchema.parse({ DATABASE_URL: 'postgres://db:5432/vp' }));

    expect(config.postgres.url).toBe('postgres://db:5432/vp');
    expect(config.auth.adminToken).toBeUndefined();
    expect(config.s3.accessKeyId).toBeUndefined();
  });

  it.each([
    { nodeEnv: 'test', kind: 'in-memory' },
    { nodeEnv: 'development', kind: 'external' },
    { nodeEnv: 'production', kind: 'external' },
  ])('derives the $kind family from NODE_ENV=$nodeEnv', ({ nodeEnv, kind }) => {
    const env = envFor(nodeEnv);

    expect(toAppConfig(env).kind).toBe(kind);
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

describe('packages/env-schema: inProcessAppConfig', () => {
  it('runs an in-process app on the in-memory family over the schema defaults', () => {
    expect(inProcessAppConfig()).toMatchObject({
      kind: 'in-memory',
      buckets: { raw: 'raw', public: 'public' },
      limits: { maxInflightPerUser: 3 },
    });
  });

  it('merges a nested override without dropping its siblings', () => {
    const config = inProcessAppConfig({
      buckets: { raw: 'vp-raw' },
      limits: { maxUploadBytes: 10 },
    });

    expect(config.buckets).toEqual({ raw: 'vp-raw', public: 'public' });
    expect(config.limits).toMatchObject({ maxUploadBytes: 10, maxInflightPerUser: 3 });
  });

  it('brands an overridden CDN base the way the schema does', () => {
    expect(inProcessAppConfig({ cdn: 'http://cdn.local///' }).cdn).toBe('http://cdn.local');
  });

  it('takes a different adapter family as plain configuration', () => {
    expect(inProcessAppConfig({ kind: 'external' }).kind).toBe('external');
  });
});

function envFor(nodeEnv: string) {
  const secrets = {
    ADMIN_TOKEN: 'a',
    WEBHOOK_SIGNING_SECRET: 'b',
    S3_ACCESS_KEY_ID: 'c',
    S3_SECRET_ACCESS_KEY: 'd',
    REDIS_PASSWORD: 'e',
  };
  return AppEnvSchema.parse({ DATABASE_URL: 'postgres://db/vp', NODE_ENV: nodeEnv, ...secrets });
}
