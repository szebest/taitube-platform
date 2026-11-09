import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio images', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.imagesTitle', expected: 'Zdjęcie i baner' },
    { key: 'studio.cropBannerTitle', expected: 'Wykadruj baner' },
    { key: 'studio.cropUse', expected: 'Użyj tego obrazu' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it('names the smallest size an image may have', () => {
    expect(t('studio.imageTooSmall', { minWidth: 200, minHeight: 200 })).toEqual({
      ok: true,
      value: 'Ten obraz jest za mały: musi mieć co najmniej 200 x 200 px.',
    });
  });
});
