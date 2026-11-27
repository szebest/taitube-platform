import { nodeRuntime } from '../node';

describe('@kit/runtime/node', () => {
  it('provides the clock, randomness, env and fetch, and no CookieJar: a request owns those', () => {
    const provided = nodeRuntime({ env: { PORT: '3000' } }).map(({ token }) => token.name);

    expect(provided).toEqual(['Clock', 'Random', 'EnvSource', 'Fetch']);
  });
});
