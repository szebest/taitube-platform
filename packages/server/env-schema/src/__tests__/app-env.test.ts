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
import { PLATFORM_ENV } from '../platform-env';

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

  it('carries exactly the keys the two schemas declare', () => {
    const declared = [...Object.keys(AppEnvShape.shape), ...Object.keys(PLATFORM_ENV)];

    expect(Object.keys(example).sort()).toEqual(declared.sort());
  });

  it.each([
    { scenario: 'the database', key: 'DATABASE_URL' as const, expected: 'localhost' },
    { scenario: 'redis', key: 'REDIS_URL' as const, expected: 'localhost' },
    { scenario: 'object storage', key: 'S3_ENDPOINT' as const, expected: 'localhost' },
    { scenario: 'the CDN', key: 'CDN_BASE_URL' as const, expected: 'localhost' },
  ])('keeps $scenario local in the unmodified example', ({ key, expected }) => {
    expect(String(AppEnvSchema.parse(example)[key])).toContain(expected);
  });

  it.each(['TURBO_TELEMETRY_DISABLED', 'DO_NOT_TRACK'])('turns %s on in the example', (key) => {
    expect(example[key]).toBe('1');
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
    const unset = AppEnvShape.shape[key].safeParse(undefined);

    expect(unset.success ? unset.data : undefined).toBeUndefined();
  });

  const productionSecrets = Object.fromEntries(
    SECRET_KEYS.map((key) => [
      key,
      key === 'DATABASE_URL' ? 'postgres://app:s3cret@db/vp' : `${key}-rotated`,
    ])
  );
  const production = {
    ...example,
    ...productionSecrets,
    NODE_ENV: 'production',
    AUTH_MODE: 'jwks',
    AUTH_JWKS_URL: 'https://idp.example/.well-known/jwks.json',
    ADMIN_TOKEN: '',
    DATABASE_URL_MIGRATIONS: '',
  };

  function refusals(env: Record<string, string>): [string, string][] {
    const parsed = AppEnvSchema.safeParse(env);
    return (parsed.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]);
  }

  it('boots production once every secret is a real value and auth verifies a real issuer', () => {
    expect(refusals(production)).toEqual([]);
  });

  it('refuses the unmodified example under production, naming every local credential', () => {
    expect(refusals({ ...example, NODE_ENV: 'production' })).toEqual([
      ['DATABASE_URL', 'holds a credential this repo ships for local use'],
      ['S3_ACCESS_KEY_ID', 'holds a credential this repo ships for local use'],
      ['S3_SECRET_ACCESS_KEY', 'holds a credential this repo ships for local use'],
      ['REDIS_PASSWORD', 'holds a credential this repo ships for local use'],
      ['AUTH_MODE', 'dev verifies the public dev key; use jwks'],
      ['ADMIN_TOKEN', 'is refused in production: admin comes from a verified token role'],
    ]);
  });

  it.each([
    { key: 'S3_ACCESS_KEY_ID', value: '', message: 'is required in production' },
    {
      key: 'REDIS_PASSWORD',
      value: 'vp',
      message: 'holds a credential this repo ships for local use',
    },
    {
      key: 'REDIS_URL',
      value: 'redis://:vp@redis:6379/0',
      message: 'holds a credential this repo ships for local use',
    },
    {
      key: 'ADMIN_TOKEN',
      value: 'a-real-random-token',
      message: 'is refused in production: admin comes from a verified token role',
    },
    { key: 'AUTH_MODE', value: 'dev', message: 'dev verifies the public dev key; use jwks' },
    { key: 'CORS_ORIGINS', value: '*', message: 'must name the allowed origins in production' },
    { key: 'CORS_ORIGINS', value: '', message: 'must name the allowed origins in production' },
  ])('refuses $key="$value" under production', ({ key, value, message }) => {
    expect(refusals({ ...production, [key]: value })).toEqual([[key, message]]);
  });

  it('requires a JWKS URL in jwks mode in every environment', () => {
    expect(refusals({ ...example, AUTH_MODE: 'jwks', AUTH_JWKS_URL: '' })).toContainEqual([
      'AUTH_JWKS_URL',
      'is required when AUTH_MODE=jwks',
    ]);
  });

  it('boots the example under development, where a secret may be absent', () => {
    const { ADMIN_TOKEN: _unset, ...env } = example;

    expect(AppEnvSchema.parse({ ...env, NODE_ENV: 'development' }).ADMIN_TOKEN).toBeUndefined();
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
