import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/web: en posts', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'posts.createPost', args: undefined, expected: 'Create post' },
    { key: 'posts.channelTab', args: { tab: 'posts' }, expected: 'Posts' },
    { key: 'posts.channelTab', args: { tab: 'home' }, expected: 'Home' },
    { key: 'posts.subscriptionsTab', args: { tab: 'community' }, expected: 'Community' },
    { key: 'posts.postBy', args: { channel: 'The Creator' }, expected: 'Post by The Creator' },
    { key: 'posts.likeCount', args: { count: 1 }, expected: '1 like' },
    { key: 'posts.likeCount', args: { count: 3 }, expected: '3 likes' },
    { key: 'posts.replyCount', args: { count: 1 }, expected: '1 reply' },
    { key: 'posts.replyCount', args: { count: 2 }, expected: '2 replies' },
    { key: 'posts.pollVotes', args: { count: 1 }, expected: '1 vote' },
    { key: 'posts.pollVotes', args: { count: 7 }, expected: '7 votes' },
    { key: 'posts.quizOutcome', args: { state: 'correct' }, expected: 'You got it right' },
    { key: 'posts.quizOutcome', args: { state: 'wrong' }, expected: 'Not quite' },
    { key: 'posts.optionShare', args: { percent: 33.3 }, expected: '33%' },
    { key: 'posts.sharePlaylistItems', args: { count: 4 }, expected: '4 videos' },
    { key: 'posts.shareUnavailable', args: undefined, expected: 'Unavailable' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
