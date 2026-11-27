import { translatorFor } from '#app/lib/messages/__tests__/fixtures';
import { pl } from '..';

describe('apps/client/studio: pl studio experiments', () => {
  const { t } = translatorFor('pl', { pl });

  it('names the kind of a test', () => {
    expect(t('studio.experimentHeading', { kind: 'title' })).toEqual({
      ok: true,
      value: 'Test tytułu',
    });
  });

  it('names the status of a test', () => {
    expect(t('studio.experimentStatus', { status: 'stopped' })).toEqual({
      ok: true,
      value: 'Zatrzymany',
    });
  });

  it.each([
    { key: 'studio.experimentVariantCountOption', count: 2, expected: '2 warianty' },
    {
      key: 'studio.experimentThumbnailsNeeded',
      count: 0,
      expected: 'Testy miniatur porównują dwie miniatury tego filmu, a on ma 0.',
    },
  ] as const)('counts in $key', ({ key, count, expected }) => {
    expect(t(key, { count })).toEqual({ ok: true, value: expected });
  });
});
