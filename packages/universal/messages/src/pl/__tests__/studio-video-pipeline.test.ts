import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio video pipeline', () => {
  const { t } = translatorFor('pl');

  it.each([
    {
      key: 'studio.blurShapeOption',
      write: () => t('studio.blurShapeOption', { shape: 'ellipse' }),
    },
    {
      key: 'studio.blurRow',
      write: () => t('studio.blurRow', { shape: 'rect', start: '0:05', end: '0:10' }),
    },
    {
      key: 'studio.trimSummary',
      write: () => t('studio.trimSummary', { start: '0:05', end: '1:10' }),
    },
    {
      key: 'studio.clipSuggestionLost',
      write: () => t('studio.clipSuggestionLost', { share: '4%' }),
    },
  ])('writes $key with every value in place', ({ write }) => {
    const written = write();

    expect(written.ok).toBe(true);
    expect(written.ok && written.value).not.toMatch(/[{}]/);
  });
});
