import { pl } from '..';
import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: pl studio comment settings', () => {
  const { t } = translatorFor('pl', { pl });

  it('names the review mode all', () => {
    expect(t('studio.settingsReviewOption', { mode: 'all' })).toEqual({
      ok: true,
      value: 'Wszystko',
    });
  });

  it('says what the author sees when a hide is visible', () => {
    expect(t('studio.settingsDefaultSeen', { seen: 'hide_visible' })).toEqual({
      ok: true,
      value: 'Autor widzi komentarz jako ukryty, z powodem.',
    });
  });

  it('says when a ban ends', () => {
    expect(t('studio.settingsRestrictionUntil', { date: '1 gru' })).toEqual({
      ok: true,
      value: 'Do 1 gru',
    });
  });
});
