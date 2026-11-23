import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en studio channel', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'studio.countryLabel', expected: 'Country' },
    { key: 'studio.spotlightTrailer', expected: 'Trailer for visitors' },
    { key: 'studio.bannerLinkTitle', expected: 'Banner button' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it('names the date the handle can change again', () => {
    expect(t('studio.handleCooldownUntil', { date: '1 Dec' })).toEqual({
      ok: true,
      value: 'Your handle can change again on 1 Dec.',
    });
  });
});
