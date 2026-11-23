import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio channel', () => {
  const { t } = translatorFor('pl', { pl });

  it.each([
    { key: 'studio.countryLabel', expected: 'Kraj' },
    { key: 'studio.spotlightTrailer', expected: 'Zwiastun dla odwiedzających' },
    { key: 'studio.bannerLinkTitle', expected: 'Przycisk na banerze' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it('names the date the handle can change again', () => {
    expect(t('studio.handleCooldownUntil', { date: '1 gru' })).toEqual({
      ok: true,
      value: 'Nazwę użytkownika zmienisz ponownie 1 gru.',
    });
  });
});
