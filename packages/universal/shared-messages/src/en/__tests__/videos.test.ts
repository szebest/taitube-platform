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
    {
      key: 'visibility',
      rendered: t('videos.visibility', { visibility: 'unlisted' }),
      expected: /^Unlisted$/,
    },
  ])('renders $key', ({ rendered, expected }) => {
    expect(rendered.ok && rendered.value).toMatch(expected);
  });
});
