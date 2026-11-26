import { translatorFor } from '#app/lib/messages/__tests__/fixtures';

describe('apps/client/studio: en studio experiments', () => {
  const { t } = translatorFor('en');

  it('names the kind of a test', () => {
    expect(t('studio.experimentHeading', { kind: 'both' })).toEqual({
      ok: true,
      value: 'Title and thumbnail test',
    });
  });

  it.each([
    { key: 'studio.experimentApply', variant: 'b', expected: 'Apply B' },
    { key: 'studio.experimentControl', variant: 'a', expected: 'Variant A, the control' },
  ] as const)('writes $key', ({ key, variant, expected }) => {
    expect(t(key, { variant })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'studio.experimentVariantCountOption', count: 3, expected: '3 variants' },
    {
      key: 'studio.experimentThumbnailsNeeded',
      count: 1,
      expected: 'Thumbnail tests compare two thumbnails of this video, and it has one.',
    },
  ] as const)('counts in $key', ({ key, count, expected }) => {
    expect(t(key, { count })).toEqual({ ok: true, value: expected });
  });

  it('counts impressions toward the minimum', () => {
    expect(t('studio.experimentImpressionsSoFar', { count: 420, min: 1000 })).toEqual({
      ok: true,
      value: '420 of 1,000 impressions',
    });
  });
});
