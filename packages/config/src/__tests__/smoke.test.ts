import { describe, expect, it } from 'vitest';
import { PostgresEnvSchema, loadEnv } from '../index.js';

describe('@vp/config smoke test', () => {
  it('loads default environment cleanly', () => {
    const env = loadEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.DATABASE_URL).toContain('postgres://');
    expect(env.REDIS_URL).toContain('redis://');
    expect(env.S3_BUCKET_RAW).toBe('raw');
  });

  it('validates postgres schema', () => {
    const pg = PostgresEnvSchema.parse({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb',
    });
    expect(pg.DATABASE_POOL_MAX).toBe(10);
  });
});
