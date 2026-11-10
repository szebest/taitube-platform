import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en share', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'share.targets', expected: 'Share on' },
    { key: 'share.native', expected: 'Share with an app' },
    { key: 'share.shortTitle', expected: 'Share this short' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it('names the target', () => {
    expect(t('share.onTarget', { target: 'X' })).toEqual({ ok: true, value: 'Share on X' });
  });
});
