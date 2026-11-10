import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en auth', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'auth.signIn', expected: 'Sign in' },
    { key: 'auth.noProvider', expected: 'No sign-in provider is configured for this build.' },
    { key: 'auth.expired', expected: 'Your session ended. Sign in again to carry on.' },
    { key: 'auth.upload', expected: 'Upload' },
    { key: 'auth.admin', expected: 'Admin' },
    { key: 'auth.signOut', expected: 'Sign out' },
    {
      key: 'auth.signInBody',
      expected: 'Your account keeps your likes, subscriptions and playlists on every device.',
    },
    { key: 'auth.signInDismiss', expected: 'Not now' },
    { key: 'auth.signInLike', expected: 'Sign in to like this' },
    { key: 'auth.signInDislike', expected: 'Sign in to dislike this' },
    { key: 'auth.signInComment', expected: 'Sign in to comment' },
    { key: 'auth.signInReply', expected: 'Sign in to reply' },
    { key: 'auth.signInHeart', expected: 'Sign in to heart comments' },
    { key: 'auth.signInSubscribe', expected: 'Sign in to subscribe to this channel' },
    { key: 'auth.signInSave', expected: 'Sign in to save this video' },
    { key: 'auth.signInPlaylist', expected: 'Sign in to add this to a playlist' },
    { key: 'auth.signInQueue', expected: 'Sign in to build a queue' },
    { key: 'auth.signInClip', expected: 'Sign in to make a clip' },
    { key: 'auth.signInHistory', expected: 'Sign in to keep a watch history' },
    { key: 'auth.signInReport', expected: 'Sign in to report this' },
    { key: 'auth.signInBell', expected: 'Sign in to get notifications' },
    { key: 'auth.signInFeedback', expected: 'Sign in to tune your recommendations' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });
});
