import { z } from 'zod';
import { describeEnvKey } from '../env-introspection';

const comma = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((value) => value.split(',').filter(Boolean));

const Schema = z.object({
  PORT: z.coerce.number().int().min(0).default(3000),
  THREADS: z.coerce.number().int().positive().default(2),
  RATIO: z.coerce.number().min(0).max(1).default(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info']).default('debug'),
  WEB_URL: z.url().default('http://localhost:5173'),
  USER_ID: z.uuid().default('018f0000-0000-7000-8000-000000000001'),
  ORIGINS: comma('http://localhost:5173,http://localhost:5174'),
  PROXY: comma(''),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),
  PASSWORD: z.string().optional(),
  DATABASE_URL: z.url(),
});

const describeKey = (key: keyof typeof Schema.shape) => describeEnvKey(Schema.shape[key]);

describe('packages/config: env-introspection', () => {
  it.each([
    { key: 'PORT', type: 'integer >= 0', value: '3000' },
    { key: 'THREADS', type: 'integer > 0', value: '2' },
    { key: 'RATIO', type: 'number >= 0 <= 1', value: '1' },
    { key: 'LOG_LEVEL', type: 'trace | debug | info', value: 'debug' },
    { key: 'WEB_URL', type: 'url', value: 'http://localhost:5173' },
    { key: 'USER_ID', type: 'uuid', value: expect.stringMatching(/^[0-9a-f-]{36}$/) },
    { key: 'ORIGINS', type: 'comma list', value: expect.stringContaining('localhost:5173') },
    { key: 'PROXY', type: 'comma list', value: '' },
    { key: 'REDIS_URL', type: 'string', value: 'redis://localhost:6379/0' },
  ] as const)('reads $key as $type defaulting to $value', ({ key, type, value }) => {
    const shape = describeKey(key);

    expect(shape.type).toBe(type);
    expect(shape.default).toMatchObject({ kind: 'value', value });
  });

  it('reads a key the environment may omit as unset', () => {
    expect(describeKey('PASSWORD').default).toEqual({ kind: 'unset' });
  });

  it('reads a key without a default as required', () => {
    expect(describeKey('DATABASE_URL')).toEqual({ type: 'url', default: { kind: 'required' } });
  });
});
