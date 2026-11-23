import { translatorFor } from '../../__tests__/web-fixtures';

describe('@vp/messages: en signInPrompt', () => {
  const { t } = translatorFor('en');

  it.each([
    {
      key: 'signInPrompt.body',
      expected: 'Your account keeps your likes, subscriptions and playlists on every device.',
    },
    { key: 'signInPrompt.dismiss', expected: 'Not now' },
    { key: 'signInPrompt.like', expected: 'Sign in to like this' },
    { key: 'signInPrompt.dislike', expected: 'Sign in to dislike this' },
    { key: 'signInPrompt.comment', expected: 'Sign in to comment' },
    { key: 'signInPrompt.reply', expected: 'Sign in to reply' },
    { key: 'signInPrompt.heart', expected: 'Sign in to heart comments' },
    { key: 'signInPrompt.subscribe', expected: 'Sign in to subscribe to this channel' },
    { key: 'signInPrompt.save', expected: 'Sign in to save this video' },
    { key: 'signInPrompt.playlist', expected: 'Sign in to add this to a playlist' },
    { key: 'signInPrompt.queue', expected: 'Sign in to build a queue' },
    { key: 'signInPrompt.clip', expected: 'Sign in to make a clip' },
    { key: 'signInPrompt.history', expected: 'Sign in to keep a watch history' },
    { key: 'signInPrompt.report', expected: 'Sign in to report this' },
    { key: 'signInPrompt.bell', expected: 'Sign in to get notifications' },
    { key: 'signInPrompt.feedback', expected: 'Sign in to tune your recommendations' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
