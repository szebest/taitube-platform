import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '@vp/pagination';
import {
  AppEnvSchema,
  AppEnvShape,
  CoreEnvSchema,
  PostgresEnvSchema,
  SECRET_KEYS,
} from '../app-env';

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
    expect(Object.keys(example).sort()).toEqual(Object.keys(AppEnvShape.shape).sort());
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
    const browserKeys = Object.keys(AppEnvShape.shape).filter((key) =>
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

  it.each(SECRET_KEYS.map((key) => ({ key })))('gives $key no default', ({ key }) => {
    expect(AppEnvShape.shape[key].parse(undefined)).toBeUndefined();
  });

  it('refuses a production boot that is missing a secret or still holds the placeholder', () => {
    const parsed = AppEnvSchema.safeParse({ ...example, NODE_ENV: 'production', ADMIN_TOKEN: '' });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([
      ['ADMIN_TOKEN', 'is required in production'],
      [
        'WEBHOOK_SIGNING_SECRET',
        'still holds the published placeholder, which is not a credential',
      ],
    ]);
  });

  it('boots the same environment under development, where a secret may be absent', () => {
    const { ADMIN_TOKEN: _unset, ...env } = example;

    expect(AppEnvSchema.parse({ ...env, NODE_ENV: 'development' }).ADMIN_TOKEN).toBeUndefined();
  });

  it('boots production once every secret is a real value', () => {
    const secrets = Object.fromEntries(SECRET_KEYS.map((key) => [key, `${key}-rotated-value`]));

    expect(AppEnvSchema.safeParse({ ...example, ...secrets, NODE_ENV: 'production' }).success).toBe(
      true
    );
  });

  it('leaves no empty value followed by a comment, which compose reads as the value', () => {
    const content = readFileSync(resolve(__dirname, '../../../../../.env.example'), 'utf8');

    expect(content.split('\n').filter((line) => /^[A-Z0-9_]+=\s+#/.test(line))).toEqual([]);
  });

  it.each([
    { raw: undefined, expected: undefined },
    { raw: '', expected: undefined },
    { raw: '3', expected: 3 },
  ])('reads WORKER_CONCURRENCY $raw as $expected', ({ raw, expected }) => {
    expect(AppEnvShape.shape.WORKER_CONCURRENCY.parse(raw)).toBe(expected);
  });

  it.each(['# empty = stage default', 'abc', '0', '-1', '2.5'])(
    'refuses WORKER_CONCURRENCY %s',
    (raw) => {
      expect(AppEnvShape.shape.WORKER_CONCURRENCY.safeParse(raw).success).toBe(false);
    }
  );

  it('defaults the connection pool without being told', () => {
    expect(
      PostgresEnvSchema.parse({ DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb' })
        .DATABASE_POOL_MAX
    ).toBe(10);
  });
});
