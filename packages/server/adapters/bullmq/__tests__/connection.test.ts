import { redisConnectionOptions } from '../connection';

describe('redisConnectionOptions', () => {
  it.each([
    {
      scenario: 'host and port',
      url: 'redis://cache:6380',
      expected: { host: 'cache', port: 6380 },
    },
    {
      scenario: 'the default port',
      url: 'redis://cache',
      expected: { host: 'cache', port: 6379 },
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
      scenario: 'the default username, which carries no meaning',
      url: 'redis://default:secret@cache:6379',
      expected: { host: 'cache', port: 6379, password: 'secret' },
    },
    {
      scenario: 'a database index',
      url: 'redis://cache:6379/3',
      expected: { host: 'cache', port: 6379, db: 3 },
    },
  ])('parses $scenario out of the url', ({ url, expected }) => {
    expect(redisConnectionOptions(url)).toEqual(expected);
  });

  it.each([
    {
      scenario: 'prefers the url password',
      url: 'redis://:from-url@cache:6379',
      password: 'from-url',
    },
    { scenario: 'takes the separate password', url: 'redis://cache:6379', password: 'separate' },
  ])('$scenario when both are available', ({ url, password }) => {
    expect(redisConnectionOptions(url, 'separate')).toMatchObject({ password });
  });

  it('refuses a url that will not parse', () => {
    expect(() => redisConnectionOptions('not a url')).toThrow();
  });
});
