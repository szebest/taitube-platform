import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en channels', () => {
  const { t } = translatorFor('en');

  it.each([
    { count: 1, expected: '1 subscriber' },
    { count: 12_345, expected: '12K subscribers' },
  ])('counts $count subscribers', ({ count, expected }) => {
    expect(t('channels.subscribers', { count })).toEqual({ ok: true, value: expected });
  });

  it('prefixes a handle', () => {
    expect(t('channels.handle', { handle: 'ada' })).toEqual({ ok: true, value: '@ada' });
  });

  it.each([
    { key: 'channels.subscribe', expected: 'Subscribe' },
    { key: 'channels.subscribed', expected: 'Subscribed' },
    { key: 'channels.subscriptionsTitle', expected: 'Your subscriptions' },
    { key: 'channels.subscriptionsEmpty', expected: 'You are not subscribed to any channel yet' },
    { key: 'channels.subscriptionVideosTitle', expected: 'Subscription videos' },
    { key: 'channels.yourVideos', expected: 'Your videos' },
    { key: 'channels.viewChannel', expected: 'View channel' },
    { key: 'channels.spotlightTrailer', expected: 'Channel trailer' },
    { key: 'channels.spotlightReturning', expected: 'Welcome back' },
    { key: 'channels.spotlightWatch', expected: 'Watch' },
    { key: 'channels.aboutTitle', expected: 'About' },
    { key: 'channels.aboutLinks', expected: 'Links' },
    { key: 'channels.aboutCountry', expected: 'Country' },
    { key: 'channels.aboutContact', expected: 'Contact' },
    { key: 'channels.showContact', expected: 'Show contact email' },
    { key: 'channels.contactSignIn', expected: 'Sign in to see the contact email' },
    { key: 'channels.contactFailed', expected: 'The contact email could not be shown' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
