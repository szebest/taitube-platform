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
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
