import { describeEnvKey } from '../env-introspection';

describe('packages/env-schema: env-introspection', () => {
  it.each([
    { key: 'PORT', type: 'integer >= 0', value: '3000' },
    { key: 'FFMPEG_THREADS', type: 'integer > 0', value: '2' },
    { key: 'OTEL_TRACES_SAMPLER_ARG', type: 'number >= 0 <= 1', value: '1' },
    { key: 'LOG_LEVEL', type: 'trace | debug | info | warn | error', value: 'debug' },
    { key: 'WEB_URL', type: 'url', value: 'http://localhost:5173' },
    { key: 'AUTH_DEV_USER_ID', type: 'uuid', value: '00000000-0000-7000-8000-000000000001' },
    { key: 'WEBHOOK_ALLOW_PRIVATE_HOSTS', type: 'true | false', value: 'false' },
    { key: 'CORS_ORIGINS', type: 'comma list', value: expect.stringContaining('localhost:5173') },
    { key: 'TRUST_PROXY', type: 'comma list', value: '' },
    { key: 'REDIS_URL', type: 'string', value: 'redis://localhost:6379/0' },
  ] as const)('reads $key as $type defaulting to $value', ({ key, type, value }) => {
    const shape = describeEnvKey(key);

    expect(shape.type).toBe(type);
    expect(shape.default).toMatchObject({ kind: 'value', value });
  });

  it.each([
    'REDIS_PASSWORD',
    'AUTH_JWKS_URL',
    'WORKER_CONCURRENCY',
    'DATABASE_URL_MIGRATIONS',
  ] as const)('reads %s as unset when the environment omits it', (key) => {
    expect(describeEnvKey(key).default).toEqual({ kind: 'unset' });
  });

  it('reads DATABASE_URL as required', () => {
    expect(describeEnvKey('DATABASE_URL')).toEqual({ type: 'url', default: { kind: 'required' } });
  });
});
