import { withEnv } from '@vp/testing';
import { getRedisConnectionOptions } from '../connection';

const REDIS_ENV = {
  REDIS_URL: undefined,
  REDIS_HOST: undefined,
  REDIS_PORT: undefined,
  REDIS_PASSWORD: undefined,
};

describe('getRedisConnectionOptions', () => {
  it('returns the caller override untouched', async () => {
    const override = { host: 'given', port: 1234 };
    await withEnv({ ...REDIS_ENV, REDIS_URL: 'redis://ignored:6380' }, () => {
      expect(getRedisConnectionOptions(override)).toBe(override);
    });
  });

  it('falls back to localhost when nothing is configured', async () => {
    await withEnv(REDIS_ENV, () => {
      expect(getRedisConnectionOptions()).toEqual({ host: '127.0.0.1', port: 6379 });
    });
  });

  it('reads the discrete host, port and password variables', async () => {
    await withEnv(
      { ...REDIS_ENV, REDIS_HOST: 'redis', REDIS_PORT: '6380', REDIS_PASSWORD: 'hunter2' },
      () => {
        expect(getRedisConnectionOptions()).toEqual({
          host: 'redis',
          port: 6380,
          password: 'hunter2',
        });
      }
    );
  });

  it.each([
    {
      scenario: 'host and port',
      url: 'redis://cache:6380',
      expected: { host: 'cache', port: 6380 },
    },
    {
      scenario: 'an embedded password',
      url: 'redis://:p%40ss@cache:6379',
      expected: { host: 'cache', port: 6379, password: 'p@ss' },
    },
    {
      scenario: 'a username other than default',
      url: 'redis://alice:secret@cache:6379',
      expected: { host: 'cache', port: 6379, password: 'secret', username: 'alice' },
    },
    {
      scenario: 'a database index',
      url: 'redis://cache:6379/3',
      expected: { host: 'cache', port: 6379, db: 3 },
    },
  ])('parses $scenario out of REDIS_URL', async ({ url, expected }) => {
    await withEnv({ ...REDIS_ENV, REDIS_URL: url }, () => {
      expect(getRedisConnectionOptions()).toEqual(expected);
    });
  });

  it('drops the default username that carries no meaning', async () => {
    await withEnv({ ...REDIS_ENV, REDIS_URL: 'redis://default:secret@cache:6379' }, () => {
      expect(getRedisConnectionOptions()).toEqual({
        host: 'cache',
        port: 6379,
        password: 'secret',
      });
    });
  });

  it('prefers the url password over the environment one', async () => {
    await withEnv(
      { ...REDIS_ENV, REDIS_URL: 'redis://:from-url@cache:6379', REDIS_PASSWORD: 'from-env' },
      () => {
        expect(getRedisConnectionOptions()).toMatchObject({ password: 'from-url' });
      }
    );
  });

  it('takes the environment password when the url carries none', async () => {
    await withEnv(
      { ...REDIS_ENV, REDIS_URL: 'redis://cache:6379', REDIS_PASSWORD: 'from-env' },
      () => {
        expect(getRedisConnectionOptions()).toMatchObject({ password: 'from-env' });
      }
    );
  });

  it('falls through to the discrete variables when the url will not parse', async () => {
    await withEnv({ ...REDIS_ENV, REDIS_URL: 'not a url', REDIS_HOST: 'redis' }, () => {
      expect(getRedisConnectionOptions()).toEqual({ host: 'redis', port: 6379 });
    });
  });
});
