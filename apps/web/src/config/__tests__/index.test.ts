import { resolveApiBaseUrl } from '../index';

describe('apps/web: config', () => {
  it.each([
    { scenario: 'defaults to the local API', env: {}, expected: 'http://localhost:3000' },
    {
      scenario: 'reads REACT_APP_API_BASE_URL and drops a trailing slash',
      env: { REACT_APP_API_BASE_URL: 'http://api.local:8080/' },
      expected: 'http://api.local:8080',
    },
    {
      scenario: 'ignores an empty override rather than producing a relative URL',
      env: { REACT_APP_API_BASE_URL: '' },
      expected: 'http://localhost:3000',
    },
  ])('$scenario', ({ env, expected }) => {
    expect(resolveApiBaseUrl(env)).toBe(expected);
  });
});
