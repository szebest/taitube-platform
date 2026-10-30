import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en errorPage', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'errorPage.notFoundTitle', expected: 'Page not found' },
    { key: 'errorPage.forbiddenTitle', expected: 'You do not have access to this' },
    { key: 'errorPage.unauthorisedTitle', expected: 'Sign in to continue' },
    { key: 'errorPage.rateLimitedTitle', expected: 'Slow down for a moment' },
    { key: 'errorPage.serverTitle', expected: 'Something went wrong on our side' },
    { key: 'errorPage.genericTitle', expected: 'There was an error while loading the page' },
    { key: 'errorPage.home', expected: 'Go to the home page' },
  ] as const)('renders $key', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
