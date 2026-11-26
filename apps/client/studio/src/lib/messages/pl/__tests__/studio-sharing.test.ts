import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/studio: pl studio sharing', () => {
  const { t } = translatorFor('pl', { pl });

  it('names the expiry', () => {
    expect(t('studio.shareLinkExpiryOption', { expiry: '7d' })).toEqual({
      ok: true,
      value: '7 dniach',
    });
  });

  it('names the state of a link', () => {
    expect(t('studio.shareLinkState', { state: 'expired' })).toEqual({ ok: true, value: 'Wygasł' });
  });

  it.each([
    { key: 'studio.shareLinkCopyFor', values: { label: 'Prasa' }, expected: 'Kopiuj link Prasa' },
    {
      key: 'studio.passwordInvalid',
      values: { min: 4, max: 128 },
      expected: 'Użyj od 4 do 128 znaków.',
    },
  ] as const)('writes $key', ({ key, values, expected }) => {
    expect(t(key, values)).toEqual({ ok: true, value: expected });
  });
});
