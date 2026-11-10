import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio images', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.imagesTitle', expected: 'Picture and banner' },
    { key: 'studio.cropBannerTitle', expected: 'Frame your banner' },
    { key: 'studio.cropUse', expected: 'Use this image' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it('names the smallest size an image may have', () => {
    expect(t('studio.imageTooSmall', { minWidth: 200, minHeight: 200 })).toEqual({
      ok: true,
      value: 'This image is too small: it must be at least 200 x 200 px.',
    });
  });
});
