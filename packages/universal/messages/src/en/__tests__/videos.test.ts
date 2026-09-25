import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en videos', () => {
  const { t } = translatorFor('en');

  it.each([
    { count: 1, expected: '1 view' },
    { count: 999, expected: '999 views' },
    { count: 1_234_567, expected: '1.2M views' },
  ])('counts $count views', ({ count, expected }) => {
    expect(t('videos.views', { count })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { position: 1, expected: '1st' },
    { position: 2, expected: '2nd' },
    { position: 3, expected: '3rd' },
    { position: 11, expected: '11th' },
    { position: 21, expected: '21st' },
  ])('ranks $position through the ordinal plural rules', ({ position, expected }) => {
    expect(t('videos.rank', { position })).toEqual({ ok: true, value: expected });
  });

  it('writes a rank in the locale numbering system', () => {
    expect(translatorFor('en-u-nu-deva').t('videos.rank', { position: 3 })).toEqual({
      ok: true,
      value: '\u0969rd',
    });
  });

  it.each([
    {
      key: 'publishedRelative',
      rendered: t('videos.publishedRelative', { when: '2026-09-22T12:00:00Z' }),
      expected: /^Published Sep 22, 2026$/,
    },
    {
      key: 'categories',
      rendered: t('videos.categories', { names: ['Music', 'Sport'] }),
      expected: /^In Music and Sport$/,
    },
    { key: 'resolution', rendered: t('videos.resolution', { height: 2160 }), expected: /^2160p$/ },
    {
      key: 'visibility',
      rendered: t('videos.visibility', { visibility: 'unlisted' }),
      expected: /^Unlisted$/,
    },
  ])('renders $key', ({ rendered, expected }) => {
    expect(rendered.ok && rendered.value).toMatch(expected);
  });
});
