import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en watch', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'watch.subscribe', args: undefined, expected: 'Subscribe' },
    { key: 'watch.subscribed', args: undefined, expected: 'Subscribed' },
    { key: 'watch.share', args: undefined, expected: 'Share' },
    { key: 'watch.shareTitle', args: undefined, expected: 'Share this video' },
    { key: 'watch.shareLink', args: undefined, expected: 'Link' },
    { key: 'watch.shareStartAt', args: { time: '1:30' }, expected: 'Start at 1:30' },
    { key: 'watch.linkCopied', args: undefined, expected: 'Link copied' },
    { key: 'watch.copyFailed', args: undefined, expected: 'The link could not be copied' },
    {
      key: 'watch.subscribeFailed',
      args: undefined,
      expected: 'Your subscription could not be changed',
    },
    {
      key: 'watch.reactionFailed',
      args: undefined,
      expected: 'Your reaction could not be saved',
    },
    { key: 'watch.discussion', args: undefined, expected: 'Discussion' },
    { key: 'watch.discussionEmpty', args: undefined, expected: 'Nobody has said anything yet' },
    {
      key: 'watch.discussionSignIn',
      args: undefined,
      expected: 'Sign in to join the discussion',
    },
    {
      key: 'watch.discussionFailed',
      args: undefined,
      expected: 'The discussion could not be loaded',
    },
    { key: 'watch.repliesFailed', args: undefined, expected: 'The replies could not be loaded' },
    { key: 'watch.showMoreReplies', args: undefined, expected: 'Show more replies' },
    { key: 'watch.commentFailed', args: undefined, expected: 'Your comment could not be posted' },
    { key: 'watch.commentEditFailed', args: undefined, expected: 'Your change could not be saved' },
    {
      key: 'watch.commentDeleteFailed',
      args: undefined,
      expected: 'The comment could not be deleted',
    },
    { key: 'watch.editComment', args: undefined, expected: 'Edit' },
    { key: 'watch.editCommentLabel', args: undefined, expected: 'Edit comment' },
    { key: 'watch.saveComment', args: undefined, expected: 'Save' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
