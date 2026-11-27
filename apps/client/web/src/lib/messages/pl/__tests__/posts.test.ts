import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/web: pl posts', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'posts.createPost', args: undefined, expected: 'Utwórz post' },
    { key: 'posts.channelTab', args: { tab: 'posts' }, expected: 'Posty' },
    { key: 'posts.subscriptionsTab', args: { tab: 'community' }, expected: 'Społeczność' },
    { key: 'posts.likeCount', args: { count: 1 }, expected: '1 polubienie' },
    { key: 'posts.likeCount', args: { count: 3 }, expected: '3 polubienia' },
    { key: 'posts.likeCount', args: { count: 5 }, expected: '5 polubień' },
    { key: 'posts.replyCount', args: { count: 1 }, expected: '1 odpowiedź' },
    { key: 'posts.replyCount', args: { count: 2 }, expected: '2 odpowiedzi' },
    { key: 'posts.pollVotes', args: { count: 1 }, expected: '1 głos' },
    { key: 'posts.pollVotes', args: { count: 4 }, expected: '4 głosy' },
    { key: 'posts.quizOutcome', args: { state: 'wrong' }, expected: 'Niestety nie' },
    { key: 'posts.sharePlaylistItems', args: { count: 5 }, expected: '5 filmów' },
    { key: 'posts.shareUnavailable', args: undefined, expected: 'Niedostępne' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
