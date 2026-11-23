import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl share', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'share.targets', expected: 'Udostępnij w' },
    { key: 'share.native', expected: 'Udostępnij w aplikacji' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it('names the target', () => {
    expect(t('share.onTarget', { target: 'X' })).toEqual({ ok: true, value: 'Udostępnij w X' });
  });
});
