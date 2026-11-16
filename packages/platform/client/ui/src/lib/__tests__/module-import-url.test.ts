import { moduleUrlOf, retryUrl } from '../module-import-url';

describe('@vp/ui: moduleUrlOf', () => {
  it.each([
    {
      name: 'Chrome',
      message: 'Failed to fetch dynamically imported module: https://cdn.test/assets/a-1f.js',
      url: 'https://cdn.test/assets/a-1f.js',
    },
    {
      name: 'Firefox',
      message: 'error loading dynamically imported module: https://cdn.test/assets/a-1f.js',
      url: 'https://cdn.test/assets/a-1f.js',
    },
    {
      name: 'Safari, which names no URL',
      message: 'Importing a module script failed.',
      url: undefined,
    },
    { name: 'an unrelated message', message: 'x is not a function', url: undefined },
  ])('reads the URL $name gives', ({ message, url }) => {
    expect(moduleUrlOf(new TypeError(message))).toBe(url);
  });

  it.each([null, 'https://cdn.test/a.js', 42])('reads none from %s', (value) => {
    expect(moduleUrlOf(value)).toBeUndefined();
  });
});

describe('@vp/ui: retryUrl', () => {
  it('adds the attempt to the query and keeps what was there', () => {
    expect(retryUrl('https://cdn.test/assets/a.js?v=1', 2)).toBe(
      'https://cdn.test/assets/a.js?v=1&vp-retry=2'
    );
  });
});
