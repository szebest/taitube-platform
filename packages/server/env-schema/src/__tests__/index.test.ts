import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@vp/pagination';
import { AppEnvSchema, CoreEnvSchema, PostgresEnvSchema } from '../index';

const CLOUD_HOSTS = [/r2\.cloudflarestorage\.com/, /neon\.tech/, /grafana\.net/];

function parseEnvExample(): Record<string, string> {
  const content = readFileSync(resolve(__dirname, '../../../../../.env.example'), 'utf8');
  const parsed: Record<string, string> = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalIdx = line.indexOf('=');
    if (equalIdx === -1) continue;

    const value = line.slice(equalIdx + 1).trim();
    const commentIdx = value.indexOf('#');
    parsed[line.slice(0, equalIdx).trim()] =
      commentIdx === -1 ? value : value.slice(0, commentIdx).trim();
  }

  return parsed;
}

describe('packages/env-schema: the environment contract', () => {
  const example = parseEnvExample();

  it('carries exactly the keys the schema declares', () => {
    expect(Object.keys(example).sort()).toEqual(Object.keys(AppEnvSchema.shape).sort());
  });

  it.each([
    { scenario: 'the database', key: 'DATABASE_URL' as const, expected: 'localhost' },
    { scenario: 'redis', key: 'REDIS_URL' as const, expected: 'localhost' },
    { scenario: 'object storage', key: 'S3_ENDPOINT' as const, expected: 'localhost' },
    { scenario: 'the CDN', key: 'CDN_BASE_URL' as const, expected: 'localhost' },
    { scenario: 'the public API', key: 'PUBLIC_API_URL' as const, expected: 'localhost' },
    { scenario: 'turbo telemetry', key: 'TURBO_TELEMETRY_DISABLED' as const, expected: '1' },
    { scenario: 'do-not-track', key: 'DO_NOT_TRACK' as const, expected: '1' },
  ])('keeps $scenario local in the unmodified example', ({ key, expected }) => {
    expect(String(AppEnvSchema.parse(example)[key])).toContain(expected);
  });

  it('declares no browser build variable', () => {
    const browserKeys = Object.keys(AppEnvSchema.shape).filter((key) =>
      key.startsWith('REACT_APP_')
    );

    expect(browserKeys).toEqual([]);
  });

  it('names no cloud host anywhere in the example', () => {
    const offenders = Object.entries(example).filter(([, value]) =>
      CLOUD_HOSTS.some((host) => host.test(value))
    );

    expect(offenders).toEqual([]);
  });

  it('takes its page bounds from the shared page-size constants', () => {
    const core = CoreEnvSchema.parse({});

    expect(core.PAGE_SIZE_DEFAULT).toBe(PAGE_SIZE_DEFAULT);
    expect(core.PAGE_SIZE_MAX).toBe(PAGE_SIZE_MAX);
  });

  it('defaults the connection pool without being told', () => {
    expect(
      PostgresEnvSchema.parse({ DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb' })
        .DATABASE_POOL_MAX
    ).toBe(10);
  });
});
